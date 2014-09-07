"use strict";

// PAR: consists of several functions that take a file handle and a callback.
// The functions add the callback to a queue and send the file handle off to a worker to be parsed into a header object [and data buffer, if applicable]. 
// The worker returns the parsed data to the main thread, which then forwards it on to the callback at the front of the queue.
// there is a separate worker (each with its own specific code) for set, tet, pos, and cut.
var PAR = (function(){

	// ==== WORKER CODE ===============================================================================
	var tetWorkerCode = function(){
		"use strict";
		
		var REGEX_HEADER_A = /((?:[\S\s](?!\r\ndata_start))*[\S\s])(\r\ndata_start)/
		var REGEX_HEADER_B = /(\S*) ([\S ]*)/g
		var DATA_END = "\r\ndata_end";
		
		var ParseTetrodeFile = function(file, SPIKE_FORMAT, BYTES_PER_SPIKE){
		
			// Read the first 1024 bytes as a string to get the header and find the data start
			var reader = new FileReaderSync();
			var topStr = reader.readAsBinaryString(file.slice(0, 1024 + 1));
			var match = REGEX_HEADER_A.exec(topStr);
    		if(!match){
    			main.TetrodeFileRead('did not find end of header in tet file.',[]);
    			return;
    		}
    		var dataStart = match.index + match[0].length;
    		var header = {};
    		var headerStr = match[0];
    		while (match = REGEX_HEADER_B.exec(headerStr))
    			header[match[1]] = match[2];
    
    		if (header.spike_format != SPIKE_FORMAT){
    			main.TetrodeFileRead("Code implements '" + SPIKE_FORMAT + "' format, but data is in '" +  header.spike_format + "'.",[]);
    			return;  
    		}
            
			//Sometimes DACQ creates a header with num_spikes >0, but there are no spikes (this happens when you choose not to record a given tetrode but a file previously existed)
			if(topStr.slice(dataStart,dataStart + DATA_END.length) == DATA_END){
				header.num_spikes_claimed = header.num_spikes;
				header.num_spikes = 0;
			}
	
            var N = header.num_spikes;
    	    var dataLen = parseInt(N)*BYTES_PER_SPIKE;
		
			//read the data section of the file as an array buffer
    		var buffer = reader.readAsArrayBuffer(file.slice(dataStart,dataStart+dataLen)); 
			
			main.TetrodeFileRead(null,header,buffer,[buffer]);
			
		}
		
		var GetTetrodeAmplitude = function(buffer,N){
		
			var C = 4; //TODO: generalise this properly everywhere in the code
			var W = 50; //TODO: generalise this properly everywhere in the code
			
			var oldData = new Int8Array(buffer);
			var NxC = N*C;
			var amps = new Uint8Array(NxC);
			
			for(var i=0,p=0;i<NxC;i++){
				p += 4; // skip timestamp 
				var min = 127;
				var max = -128;
				for(var t=0;t<W;t++,p++){
					(oldData[p] > max) && (max = oldData[p]);
					(oldData[p] < min) && (min = oldData[p]);
				}
				amps[i] = max-min; 
			}

			main.GotTetAmps(amps.buffer,[amps.buffer]);
		}
	
		
	}
		
	var posWorkerCode = function(){
		"use strict";
		
		var endian = function(){
			var b = new ArrayBuffer(2);
			(new DataView(b)).setInt16(0,256,true);
			return (new Int16Array(b))[0] == 256? 'L' : 'B';
		}();
	
	    var Swap16 = function (val) {
			return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
		}
		
		var take = function(data,offset,stride){
			// takes every stride'th element from data, starting with the offset'th element
			
			var n = data.length/stride;
			var res = new data.constructor(n);
			
			for(var i=0,j=offset;i<n;i++,j+=stride)
				res[i] = data[j];
			return res;
		}
		
		var times_IN_PLACE = function(src,factor,skipVal){
			for(var i=0;i<src.length;i++)if(src[i] != skipVal)
				src[i] *= factor;
		}
		var replaceVal_IN_PLACE = function(src,find,replace){
			for(var i=0;i<src.length;i++)if(src[i] == find)
				src[i] = replace;
		}
		
		var pow2 = function(a){return a*a;}
	
		var clone = function(a){ 
			if(a.slice){
				return a.slice(0); //for basic arrays and pure ArrayBuffer
			}else{
				var result = new a.constructor(a.length); //
				result.set(a);
				return result;
			}
		}
	
	
		var REGEX_HEADER_A = /((?:[\S\s](?!\r\ndata_start))*[\S\s])(\r\ndata_start)/
		var REGEX_HEADER_B = /(\S*) ([\S ]*)/g


		var ParsePosFile = function(file,POS_FORMAT,BYTES_PER_POS_SAMPLE,MAX_SPEED,SMOOTHING_W_S){
			// Read the file as a string to get the header and find the data start
			var reader = new FileReaderSync();
			var fullStr = reader.readAsBinaryString(file);
		
			var match = REGEX_HEADER_A.exec(fullStr);
    		if(!match){
    			main.PosFileRead('did not find end of header in pos file.',[]);
    			return
    		}
			var dataStart = match.index + match[0].length;
    		var header = {};
    		var headerStr = match[0];
    		while (match = REGEX_HEADER_B.exec(headerStr))
    			header[match[1]] = match[2];
        	var dataLen = parseInt(header.num_pos_samples)*BYTES_PER_POS_SAMPLE;
            
    		if (header.pos_format != POS_FORMAT){
    			main.PosFileRead("Code implements '" + POS_FORMAT + "' format, but pos data is in '" +  header.pos_format + "'.",[]);
    			return;  
    		}
    
    		var buffer = reader.readAsArrayBuffer(file.slice(dataStart,dataStart+dataLen));
			if(endian == 'L'){
    			var data = new Int16Array(buffer);
    			for (var k=0;k<data.length;k++) //note that timestamps are 4 bytes, so this is really unhelpful if you want to read timestamps
    				data[k] = Swap16(data[k]);
    		}

			PostProcessPos(header,buffer,BYTES_PER_POS_SAMPLE,MAX_SPEED,SMOOTHING_W_S);
		}
		
		var interpXY_sub = function(XY,x_a,y_a,x_b,y_b,i,nNans){
			//interpolates from element i-1 back to i-nNans, where element i is x_b,y_b and element i-nNans-1 is x_a,x_b
			var dX = (x_b-x_a)/(nNans+1);
			var dY = (y_b-y_a)/(nNans+1);
			for(var j=0;j<nNans;j++){
				XY[(i-nNans + j)*2+0] = x_a + (j+1)*dX;
				XY[(i-nNans + j)*2+1] = y_a + (j+1)*dY; 
			}
		}
        
		var smoooth1D_IN_PLACE = function(X,stride,k){
            //Box car smoothing of length 2*k + 1
			// (If we pretend the stride=1) The first few values of X will be:
			//  X[0] = (X[0] + X[1] + ... + X[k])/(k+1)
			//  X[1] = (X[0] + X[1] + ... + X[k+1])/(k+2)
			//  ... and then we get to..
			//  X[b] = (X[b-k] + ... + X[b] + ... X[b+k])/(2*k+1)
			// and then we ramp down at the end as with the start.
                     
            //A couple of checks for unimplemented generalisations...
            if(stride != 2)
                throw("stride must be 2");
            if(2*k+1 > 256)
                throw("smoothing kernel max length is 256")
			if(k==0)
				return; //no smoothing

            /* Note: (a & 0xff) is (a mod 256) */
            var n = X.length/2;
			
            var circBuff_1 = new X.constructor(256);
            var circBuff_2 = new X.constructor(256);
            var tot_1 = 0;
            var tot_2 = 0;
            
			//a is the lowest-index in the sum, b is the central and destination index, c is the highgest index in the sum
			var a=-2*k,b=-k,c=0; 
			
			// ramp up part 1: push the first k values into the buffer and sum
			for(;c<k;a++,b++,c++){
				tot_1 += circBuff_1[c & 0xff] = X[c*2 + 0]; 
                tot_2 += circBuff_2[c & 0xff] = X[c*2 + 1];
			}
			
			// ramp up part 2: calculate the first k values
            for(;a<0;a++,b++,c++){
				tot_1 += circBuff_1[c & 0xff] = X[c*2 + 0]; 
                tot_2 += circBuff_2[c & 0xff] = X[c*2 + 1];
                X[b*2+0] = tot_1 / (c+1);
				X[b*2+1] = tot_2 / (c+1);
            }
                
            // main section
			var d = 2*k+1;
			for(;c<n;a++,b++,c++){
				tot_1 += circBuff_1[c & 0xff] = X[c*2 + 0]; 
                tot_2 += circBuff_2[c & 0xff] = X[c*2 + 1];
				X[b*2+0] = tot_1/d;
				X[b*2+1] = tot_2/d;
				tot_1 -= circBuff_1[a & 0xff]; 
                tot_2 -= circBuff_2[a & 0xff];
			}
			
			// ramp down: calculate last k values
            for(;b<n;a++,b++,c++){
                X[b*2+0] = tot_1 / (n-a);
				X[b*2+1	] = tot_2 / (n-a);
				tot_1 -= circBuff_1[a & 0xff]; 
                tot_2 -= circBuff_2[a & 0xff];
            }
            
	}
		
		var PostProcessPos = function(header,buffer,BYTES_PER_POS_SAMPLE,
					MAX_SPEED, /*meters per second, e.g. 5 */
					SMOOTHING_W_S /* box car smoothing width in seconds, e.g. 0.2 */
					){
		
			var data = new Int16Array(buffer);
			var elementsPerPosSample = BYTES_PER_POS_SAMPLE/2;
			var nPos = parseInt(header.num_pos_samples); 
			var end = nPos * elementsPerPosSample; 
			var XY = new Int16Array(nPos*2);
		
			var XY = new Int16Array(
							take(new Int32Array(buffer),1,BYTES_PER_POS_SAMPLE/4).buffer
						 ); // for each pos sample take bytes 4-7, and then view them as a pair of int16s 
		
			var POS_NAN = 1023;
			var NAN16 = -32768; //custom nan value, equal to minimum int16 value
			
			replaceVal_IN_PLACE(XY,POS_NAN,NAN16); //switch from axona custom nan value to our custom nan value
			
			var ppm = parseInt(header.pixels_per_metre);
			var UNITS_PER_M = 1000;
			times_IN_PLACE(XY,UNITS_PER_M/ppm,NAN16); //convert from pixels to milimeters (we use mm because then we can happily use Int16s)
			
			var sampFreq = parseInt(header.sample_rate);
			var pow2MaxSampStep = pow2(MAX_SPEED*UNITS_PER_M /sampFreq);
			
			// Find first (x,y) that is non-nan
			for(var start=0;start<nPos;start++)
				if(XY[start*2+0] != NAN16 && XY[start*2+1] !=NAN16)
					break;
					
			if(MAX_SPEED){					
				var x_from = XY[start*2+0];
				var y_from = XY[start*2+1];
				var jumpLen = 1;
				
				// Set big jump sections to nan
				for(var i=start+1,nJumpy=0; i<nPos; i++){
					
					// check if this pos is already nan
					// or if (dx^2 + dy^2)/dt^2 is greater than maxSpeed^2, where the d's are relative to the last "good" sample
					if ( XY[i*2+0] == NAN16 || XY[i*2+1] == NAN16 || 
						(pow2(x_from-XY[i*2+0]) + pow2(y_from-XY[i*2+1])) / pow2(jumpLen) > pow2MaxSampStep ){
						//sample is nan or speed is too large, so make this a jump
						XY[i*2 + 0] = XY[i*2 + 1] = NAN16; 
						nJumpy++;
						jumpLen++;
					}else{
						//speed is sufficiently small, so this point is ok
						jumpLen = 1;
						x_from = XY[i*2 + 0];
						y_from = XY[i*2 + 1];
					}
				}
			}
			
            //Interpolation...		TODO: verify that this does exactly what we want
            var x_a = XY[start*2+0];
            var y_a = XY[start*2+1];
            var nNans = start; //this will cause first non-nan to be copied back through all previous nan values
            for(var i=start;i<nPos;i++){
                var x_b = XY[i*2+0];
                var y_b = XY[i*2+1];
                if(x_b == NAN16 || y_b == NAN16){
                    nNans++;
                }else{
					if(nNans) 
						interpXY_sub(XY,x_a,y_a,x_b,y_b,i,nNans)
                    x_a = x_b;
                    y_a = y_b;
                    nNans = 0;
                }
            }
			
			if(nNans) //fill end-nan values with last non-nan val
				interpXY_sub(XY,x_a,y_a,x_a,y_a,i,nNans)

    		var k = Math.floor(sampFreq*SMOOTHING_W_S/2); //the actual filter will be of length k*2+1, which means it may be one sample longer than desired			
			smoooth1D_IN_PLACE(XY,2,k)			
			header.n_jumpy = nJumpy; //includes untracked
			header.max_vals = [(parseInt(header.window_max_y)-parseInt(header.window_min_y))*UNITS_PER_M/ppm ,
							   (parseInt(header.window_max_x)-parseInt(header.window_min_x))*UNITS_PER_M/ppm ]; //TODO: decide which way round we want x and y
			header.units_per_meter = UNITS_PER_M;
			main.PosFileRead(null,header, XY.buffer,[XY.buffer]);
		}
		
		
	}
	
	var cutWorkerCode = function(){
		"use strict";
		
		var REGEX_CUT_A = /n_clusters:\s*(\S*)\s*n_channels:\s*(\S*)\s*n_params:\s*(\S*)\s*times_used_in_Vt:\s*(\S*)\s*(\S*)\s*(\S*)\s*(\S*)/;
		var REGEX_CUT_B = /Exact_cut_for: ((?:[\s\S](?! spikes:))*[\s\S])\s*spikes: ([0-9]*)/;
		var REGEX_CUT_C = /[0-9]+/g;
		var MAX_LENGTH_MATCH_CUT_B = 300;//this is needed so that when we read in chunks of the cut file we dont have to apply the regex_b to the whole thing each time

		var ParseCutFile = function(file){
		
			// Read the file as a string to get the header 
			var reader = new FileReaderSync();
			var fullStr = reader.readAsBinaryString(file);
			
			var match = REGEX_CUT_A.exec(fullStr);		
			var cutProps = {};
        	cutProps.n_clusters =  parseInt(match[1]);
        	cutProps.n_channels =  parseInt(match[2]);
        	cutProps.n_params =  parseInt(match[3]);
        	match = REGEX_CUT_B.exec(fullStr);
        	cutProps.exp = match[1];
        	cutProps.N = parseInt(match[2]);
        	cutProps.dataStart = match.index + match[0].length;
        	cutProps.is_clu = false;
        
        	var cutStr = fullStr.slice(cutProps.dataStart);// results in a copy being made (probably)
        	var cut = []; //TODO: use Uin32Array instead
        	while(match = REGEX_CUT_C.exec(cutStr))
        		cut.push(parseInt(match[0]));
				
			main.CutFileRead(null,cutProps,cut);
		}
		
		var ParseCluFile = function(file){
			var reader = new FileReaderSync();
			var fullStr = reader.readAsBinaryString(file);
        	var cut = []; //TODO: use Uin32Array instead
			var match;
        	while(match = REGEX_CUT_C.exec(fullStr))
        		cut.push(parseInt(match[0]));
			var cutProps = {nGroups: cut.shift(),is_clu: true}
			main.CutFileRead(null,cutProps,cut);
		}
		
		// This function doesn't bother doing everything it just reads the experiment name
		var GetCutFileExpName = function(file,tet,filename){
			var reader = new FileReaderSync();
			var BLOCK_SIZE = 10*1024; //10KBs at a time.
			var str = "";
			for(var offset=0,match=null;!match && offset<file.size; offset+=BLOCK_SIZE){
				str = str.slice(-MAX_LENGTH_MATCH_CUT_B) + reader.readAsBinaryString(file.slice(offset,offset+BLOCK_SIZE));
				match = REGEX_CUT_B.exec(str);
				if(match){
					main.CutFileGotExpName(filename,match[1],tet);
					return;
				}
			}
			main.CutFileGotExpName(filename,null,tet); //couldn't find the name
		}
	}
	
	var setWorkerCode = function(){
		"use strict";
		var REGEX_HEADER_B = /(\S*) ([\S ]*)/g

		var ParseSetFile = function(file){
			// Read the file as a string to get the header 
			var reader = new FileReaderSync();
			var fullStr = reader.readAsBinaryString(file);
			var header = {};
			var match;
    		while (match = REGEX_HEADER_B.exec(fullStr))
    			header[match[1]] = match[2];
			main.SetFileRead(null,header,file.name);
		}
	}
	
	// ==== WORKER CODE ===============================================================================
	var eegWorkerCode = function(){
		"use strict";
		
		var REGEX_HEADER_A = /((?:[\S\s](?!\r\ndata_start))*[\S\s])(\r\ndata_start)/
		var REGEX_HEADER_B = /(\S*) ([\S ]*)/g
		var DATA_END = "\r\ndata_end";
		
		var ParseEEGFile = function(file){
		
			// Read the first 1024 bytes as a string to get the header and find the data start
			var reader = new FileReaderSync();
			var topStr = reader.readAsBinaryString(file.slice(0, 1024 + 1));
			var match = REGEX_HEADER_A.exec(topStr);
    		if(!match){
    			main.EEGFileRead('did not find end of header in eeg file.',[]);
    			return;
    		}
    		var dataStart = match.index + match[0].length;
    		var header = {};
    		var headerStr = match[0];
    		while (match = REGEX_HEADER_B.exec(headerStr))
    			header[match[1]] = match[2];
    
            var N = parseInt(header.num_EEG_samples);
			var b = parseInt(header.bytes_per_sample);
    	    var dataLen = N*b;
		
			//read the data section of the file as an array buffer
    		var buffer = reader.readAsArrayBuffer(file.slice(dataStart,dataStart+dataLen)); 
			
			main.EEGFileRead(null,header,buffer,[buffer]);
			
		}
	}
	
	// ================= End Of Worker Code ========================================================================
	
	var BYTES_PER_POS_SAMPLE = 4 + 2 + 2 + 2 + 2 + 2 + 2 + (2 + 2) ;//the last two uint16s are numpix1 and bnumpix2 repeated
	var BYTES_PER_SPIKE = 4*(4 + 50);
    var SPIKE_FORMAT = "t,ch1,t,ch2,t,ch3,t,ch4";
    var POS_FORMAT = "t,x1,y1,x2,y2,numpix1,numpix2";
	var POS_NAN = 1023;
	
	var callbacks = {pos:[],cut:[],set:[],tet:[],eeg:[]};  //we use callback cues as the workers have to process files in order
	
    var LoadTetrodeWithWorker = function(file,callback){
		callbacks.tet.push(callback); 
		tetWorker.ParseTetrodeFile(file,SPIKE_FORMAT, BYTES_PER_SPIKE);
	}
	var TetrodeFileRead = function(errorMessage,header,buffer){
		if(errorMessage)
			throw(errorMessage);
		callbacks.tet.shift()({header:header,buffer:buffer});
	}	
	var GetTetrodeAmplitudeWithWorker = function(buffer,header,N,callback){
		callbacks.tet.push(callback); 
		buffer = buffer.slice(0); //we clone it so there is still a copy in the main thread;
		tetWorker.GetTetrodeAmplitude(buffer,N,[buffer]);
    }
	var GotTetAmps = function(ampsBuffer){
        callbacks.tet.shift()(new Uint8Array(ampsBuffer));
	}
	
	var LoadPosWithWorker = function(file,state){
		callbacks.pos.push(state.callback);
    	posWorker.ParsePosFile(file,POS_FORMAT,BYTES_PER_POS_SAMPLE,state.MAX_SPEED,state.SMOOTHING_W_S);
    }
	var PosFileRead = function(errorMessage,header,buffer){
		if(errorMessage)
			throw(errorMessage);
		callbacks.pos.shift()({header:header, buffer:buffer});
	}	
	
	var LoadSetWithWorker = function(file,callback){
		callbacks.set.push(callback);
    	setWorker.ParseSetFile(file);
    }
	var SetFileRead = function(errorMessage,header,filename){
		if(errorMessage)
			throw(errorMessage);
		callbacks.set.shift()({header:header});
	}	
	
	//LoadCutWithWorker and LoadCluWithWorker both use the same callback queue and CutFileRead function below.
	var LoadCutWithWorker = function(file,callback){
		callbacks.cut.push(callback);
		cutWorker.ParseCutFile(file);
	}
	var LoadCluWithWorker = function(file,callback){
		callbacks.cut.push(callback);
		cutWorker.ParseCluFile(file);
	}
	var CutFileRead = function(errorMessage,header,cut){
		if(errorMessage)
			throw(errorMessage);
		callbacks.cut.shift()({cut:cut, header:header});
	}
	
	var GetCutExpNameWithWorker = function(file,tet,state,callback){
		callbacks.cut.push({callback: callback,state:state});
		cutWorker.GetCutFileExpName(file,tet,file.name);
	}
	var CutFileGotExpName = function(fileName,expName,tet){
		var c = callbacks.cut.shift();
		c.callback(c.state,expName);
	}

	var LoadEEGWithWorker = function(file,callback){
		callbacks.eeg.push(callback);
		eegWorker.ParseEEGFile(file);
	}
	var EEGFileRead = function(errorMessage,header,buffer){
		if(errorMessage)
			throw(errorMessage);
		callbacks.eeg.shift()({header: header,buffer:buffer});
	}
	
	var tetWorker = BuildBridgedWorker(tetWorkerCode,["ParseTetrodeFile","GetTetrodeAmplitude*"],["TetrodeFileRead*","GotTetAmps*"],[TetrodeFileRead,GotTetAmps]);	
	var posWorker = BuildBridgedWorker(posWorkerCode,["ParsePosFile"],["PosFileRead*"],[PosFileRead]);	
	var cutWorker = BuildBridgedWorker(cutWorkerCode,["ParseCutFile","ParseCluFile","GetCutFileExpName"],["CutFileRead","CutFileGotExpName"],[CutFileRead, CutFileGotExpName]);	
	var setWorker = BuildBridgedWorker(setWorkerCode,["ParseSetFile"],["SetFileRead"],[SetFileRead]);	
	var eegWorker = BuildBridgedWorker(eegWorkerCode,["ParseEEGFile"],["EEGFileRead"],[EEGFileRead]);	
	
    var GetPendingParseCount = function(){
        return callbacks.cut.length + callbacks.set.length + callbacks.tet.length + callbacks.pos.length;
    }
    
    var GetTetrodeTime = function(buffer,header,N){ //get spike times in milliseconds as a Uint32Array 
        var times = new Uint32Array(N);
    	var data = new Int32Array(buffer);

		for(var i=0; i<N; i++)
			times[i] = data[BYTES_PER_SPIKE/4*i]; //we are accessing the buffer as 4byte ints, we want the first 4bytes of the i'th spike

		if (endian == 'L') 
			for(var i=0;i<N; i++)
				times[i] = Swap32(times[i]);

		var timebase = parseInt(header.timebase);

		timebase /= 1000; //get it in miliseconds
		for(var i=0;i<N;i++)
			times[i] /= timebase;
            
        return times;
    }
    
	//TODO: probably want to have a function here which gets waveforms from the tetrode buffer so that other modules do not need to know details of the file format
	

	
    return {
        LoadPos: LoadPosWithWorker,
		LoadTetrode: LoadTetrodeWithWorker,
		LoadSet: LoadSetWithWorker,
        LoadCut: LoadCutWithWorker,
        LoadCut2: GetCutExpNameWithWorker,
		LoadClu: LoadCluWithWorker,
		LoadEEG: LoadEEGWithWorker,
        GetPendingParseCount: GetPendingParseCount,
        GetTetrodeTime: GetTetrodeTime,
		GetTetrodeAmplitude: GetTetrodeAmplitudeWithWorker,
		BYTES_PER_POS_SAMPLE: BYTES_PER_POS_SAMPLE,
		BYTES_PER_SPIKE: BYTES_PER_SPIKE,
		POS_NAN: POS_NAN,
		NAN16: -32768//TODO: share this with pos worker properly
    }
    
}());