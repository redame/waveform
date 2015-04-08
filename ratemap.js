"use strict";
/* TODO: better separate the two kinds of ratemap so that we can more easily reduce the work load if we ahve turned one/both off*/
T.RM = function(BYTES_PER_SPIKE,BYTES_PER_POS_SAMPLE,POS_NAN,
                CanvasUpdateCallback, CutSlotLog, TILE_CANVAS_NUM,TILE_CANVAS_NUM2,ORG,
                POS_W,POS_H,SpikeForPathCallback,PALETTE_FLAG,PALETTE_B,
				$binSizeSlider,$smoothingSlider,$binSizeVal,$smoothingVal,modeChangeCallbacks){
				
	var IM_SPIKES_FOR_PATH = 1;
	var IM_RATEMAP = 0;
	var IM_RATEMAP_DIR = 2;
	
	//these constants will be passed through to the worker for use as standard global vars in the worker's scope
	var WORKER_CONSTANTS = {IM_SPIKES_FOR_PATH: IM_SPIKES_FOR_PATH,
							IM_RATEMAP:IM_RATEMAP,
							IM_RATEMAP_DIR: IM_RATEMAP_DIR,
							POS_W: POS_W,
							POS_H: POS_H,
							BYTES_PER_POS_SAMPLE: BYTES_PER_POS_SAMPLE,
							POS_NAN: POS_NAN,
							PALETTE_B: PALETTE_B};						

	var workerFunction = function(){
        "use strict";
		var pi = 3.14159265;
		
        // Some functions copied (and simplified/extended) from Mlib.js and utils.js
		var Swap32 = function(val) {
			return   ((val & 0xFF) << 24)
				   | ((val & 0xFF00) << 8)
				   | ((val >> 8) & 0xFF00)
				   | ((val >> 24) & 0xFF);
		}
		var endian = function(){
			var b = new ArrayBuffer(2);
			(new DataView(b)).setInt16(0,256,true);
			return (new Int16Array(b))[0] == 256? 'L' : 'B';
		}();
        
		var max = function(X){
			var m = X[0];
			for(var i = 1;i< X.length; i++)
				(m < X[i]) && (m = X[i]);
			return m; //Math.max works recursively and fails for large enough arrays
		}
		var pick = function(from,indices){
			var result =  new from.constructor(indices.length); //make an array of the same type as the from array
			for(var i=0;i<indices.length;i++)
				result[i] = from[indices[i]];
			return result;
		}

		var hist_1 = function(inds,nBins){
			var result = new Uint32Array(nBins); 
			var n = inds.length;
			
			for(var i=0;i<n;i++)
				result[inds[i]]++;

			return result;
		}
	
		var hist_2 = function(indsXY,nX,nY){
			var result = new Uint32Array(nX*nY); 
			var n = indsXY.length/2;
			
			for(var i=0;i<n;i++)
				result[indsXY[i*2+1]*nX + indsXY[i*2+0]]++;

			return result;
		}
		var rdivideFloat = function(numerator,denominator){
			var ret = new Float32Array(numerator.length);
			for(var i=0;i<ret.length;i++)
				ret[i] = numerator[i] / denominator[i];
			return ret;
		}
		var rdivideFloatInPlace = function(numerator,denominator){
			for(var i=0;i<numerator.length;i++)
				numerator[i] /= denominator[i];
		}
		var IsZero = function(vector){
			var result = new Uint8ClampedArray(vector.length);
			for(var i=0;i<vector.length;i++)
				result[i] = (vector[i]==0);
			return result;
		}
		
		var GetSmoothed = function(matrix,nX,nY,W){
			var result = new Uint32Array(matrix.length);
			//kernle is box-car of size 2W+1

			for(var ky=-W;ky<=W;ky++)for(var kx=-W;kx<=W;kx++){//for each offset within the kernel square
				var y0 = ky<0? 0 : ky;
				var x0 = kx<0? 0 : kx;
				var yend = ky>0? nY : nY+ky;
				var xend = kx>0? nX : nX+kx;

				for(var y=y0;y<yend;y++)for(var x=x0;x<xend;x++)
					result[y*nX +x] += matrix[(y-ky)*nX +(x-kx)];

			}	
			return result; 
		}
		var useMask = function(vector,mask,val){
		//sets vector elemnts to val where mask is true, if val is omitted it defaults to zero
			val = typeof(val) === "number" ? val : 0;
			for(var i=0;i<mask.length;i++) if(mask[i])
					vector[i] = val;		
		}
        // =======================
        
        var posFreq = null;
		var pixPerM = null;
        var max_vals = null;
        var scale_spikes_plot = null;
		var posValXY = null; // this is the values in pixels
		var posBinXY = null; // this is posValXY / pixPerM *100/ cmPerBin
        var spikePosBinXY_b = null; //this is posValXY * the scale factor for plotting to the spikes/pos plot 
		var spikeTimes = null; // this is the spike times expressed in milliseconds
		var spikePosInd = null; // this is the spke times expressed in pos indices
		var spikePosBinXY = null; // this is posBinXY(spikePosInd,:)
		var posValDir = null; //this is the values in radians (float32)
		var posBinDir = null; //this is posVlaDir/pi*180/degPerBin ....as with posBinXY this is Uint8Clamped array, which puts a limit on the number of bins...not absolutely crucial but makes life easier in a few places
		var spikePosBinDir = null; // this is posBinDir(spikePosInd)
		var nBinsX = null;
		var nBinsY = null;
		var nBinsDir = null;
		var smoothedDwellCounts = null;
		var smoothedDirDwellCounts = null;
		var unvisitedBins = null;
        var slots = [];
		var ratemapSlotQueue = []; //holds a queue of which slotsInds need to be sent to the GetGroupRatemap function
		var desiredCmPerBin = 2.5;
        var desiredSmoothingW = 2;
		var desiredDegPerBin = 6; //valid values: 2,3,4,6,10,15..maybe larger factors too if you really want
		var desiredSmoothingDir = 0; //TODO: lookup what knid of smoothing needs to be done for dir plots.
		var desiredPosDataId = 0; //Each time we load a pos we increment this, and obviosuly we desire that all ratemap use the most recent pos data 
		var expLenInSeconds = null; //used for meanTime plot
 		var ratemapTimer = null;
		
		
		var PALETTE = function(){
			var P_COLORS = 5;
			var buffer = new ArrayBuffer(4*(P_COLORS+1));
			var buf8 = new Uint8Array(buffer);

			//set all alpha values to opaque
			for(var i=0;i<=P_COLORS;i++)
				buf8[i*4+3] = 255;

			buf8[0*4+0]= 255; buf8[0*4+1]=255; buf8[0*4+2]=255; //white

			buf8[1*4+2]= 198;
			buf8[2*4+1]= 162; buf8[2*4+2]= 255; 
			buf8[3*4+0]= 56; buf8[3*4+1]= 235; buf8[3*4+2]=32; 
			buf8[4*4+0]= 248; buf8[4*4+1]=221; 
			buf8[5*4+0]= 255; buf8[5*4+1]= 32;

			return new Uint32Array(buffer); //this is how ToImageData function wants it
		}();
	
		var SetImmutable = function(inds,slotInd,generation){
			slots[slotInd] = {inds:new Uint32Array(inds),generation:generation,num:slotInd,cmPerBin: null};
			if(spikePosBinXY) //Ok, so we have some cut data, but we cant do anythign unless we have pos and tet data.
				QueueSlot(slotInd);
		}

		var ClearCut = function(){
			slots = [];
			ClearQueue();
		}
		
		var SetBinSizeCm = function(v){
			if(v == desiredCmPerBin)
                return; //no point doing anything if the value isn't new

            ClearQueue(); //we can clear the queue because we are going to re-compute all slots unless they were already computed for these settings, but in that case there would be no reason to compute them
			desiredCmPerBin = v;
			CachePosBinIndsAndDwellMap(); //when we change the bin size we have to redo this stuff
			QueueAllSlotsLazy();
		}
		var SetBinSizeDeg = function(v){
			if(v == desiredDegPerBin)
                return; //no point doing anything if the value isn't new

            ClearQueue(); //we can clear the queue because we are going to re-compute all slots unless they were already computed for these settings, but in that case there would be no reason to compute them
			desiredDegPerBin = v;
			CachePosBinIndsAndDwellMap_Dir(); //when we change the bin size we have to redo this stuff
			QueueAllSlotsLazy();
		}
        var SetSmoothingW = function(v){
            if(v == desiredSmoothingW)
                return; //no point doing anything if the value isn't new

            ClearQueue(); //we can clear the queue because we are going to re-compute all slots unless they were already computed for these settings, but in that case there would be no reason to compute them
    	    desiredSmoothingW = v;
			CachePosBinIndsAndDwellMap(); //when we change the smoothing we have to redo this stuff
			QueueAllSlotsLazy();
		    
        }
		
		var QueueAllSlotsLazy = function(){
			//will enqueue any slots that dont match the desired settings
			for(var i=0;i<slots.length;i++)if(
					slots[i] && (
					slots[i].smoothingW != desiredSmoothingW ||
					slots[i].cmPerBin != desiredCmPerBin	 ||
					slots[i].posDataId != desiredPosDataId	 ||
					slots[i].degPerBin != desiredDegPerBin
					))
				QueueSlot(i);
		    
		}
        
		var QueueTick = function(){
            var s = ratemapSlotQueue.shift(); 
            while(!slots[s] && ratemapSlotQueue.length)
                s = ratemapSlotQueue.shift(); 
			if(slots[s]){
                GetGroupRatemap(slots[s]);
				//GetGroupRatemap_Dir(slots[s]);
			}
			ratemapTimer  = ratemapSlotQueue.length > 0 ? setTimeout(QueueTick,1) : 0;
            //TODO: may want to time the call and potentially do more within this tick
		}

		var QueueSlot = function(slotInd){
			if(ratemapSlotQueue.indexOf(slotInd) == -1)
				ratemapSlotQueue.push(slotInd);
			if(!ratemapTimer)
				ratemapTimer = setTimeout(QueueTick,1);
		}

		var ClearQueue = function(){
			clearTimeout(ratemapTimer);
            ratemapTimer = 0;
			ratemapSlotQueue = [];
		}

		var CachePosBinIndsAndDwellMap_Dir = function(){
			if(posValDir == null || spikePosInd == null)
				return;
			//at this point we have posValDir, spikePosInd and degPerBin.
			//Here we do some stuff that will be common to all groups that want to have a dir-ratemap
			
			var factor = 180/pi/desiredDegPerBin;
			posBinDir = new Uint8ClampedArray(posValDir.length);
			for(var i=0;i<posValDir.length;i++)
				posBinDir[i] = posValDir[i] * factor;
            
			spikePosBinDir = pick(posBinDir,spikePosInd); //this is a bit easier than the XY case because we just pick one value per spike rather than two
			nBinsDir = 360/desiredDegPerBin;
			var dwellDirCounts = hist_1(posBinDir,nBinsDir+1); //the +1'th bin will be combined with the zero'th bin...
			dwellDirCounts[0]+= dwellDirCounts[nBinsDir];
			dwellDirCounts = dwellDirCounts.subarray(0,nBinsDir);
						
			smoothedDirDwellCounts = dwellDirCounts; //TODO: actually smooth
		}
		
		var CachePosBinIndsAndDwellMap = function(){
			if(posValXY == null || spikePosInd == null)
				return;
				
			//at this point we have posValXY, spikePosInd and cmPerBin.
			//Here we do some stuff that will be common to all groups that want to have a ratemap
			
			// TODO: use header.max_vals rather than calculating maxes here
			var factor = 100/pixPerM /desiredCmPerBin;
			posBinXY = new Uint8ClampedArray(posValXY.length);
			for(var i=0;i<posValXY.length;i++)
				posBinXY[i] = posValXY[i] * factor;
                
            nBinsX = Math.ceil(max_vals[1]*factor) + 1; // +1 is because of zero indexing
			nBinsY = Math.ceil(max_vals[0]*factor) + 1;
            
            factor = scale_spikes_plot;
            var posBinXY_b = new Uint8ClampedArray(posValXY.length);
    		for(var i=0;i<posValXY.length;i++)
                posBinXY_b[i] = posValXY[i] * factor;
            spikePosBinXY_b = pick(new Uint16Array(posBinXY_b.buffer),spikePosInd); //same form as posBinXY_b, but we store it as 2byte blocks for easy picking
			    			
			
			spikePosBinXY = pick(new Uint16Array(posBinXY.buffer),spikePosInd); //same form as posBinXY, but we store it as 2byte blocks for easy picking
						
			var dwellCounts = hist_2(posBinXY,nBinsX,nBinsY);
			dwellCounts[0] = 0; // TODO: this was needed before we had interpolating in pos load, we might not need this line now

			//before we do the smoothing we need to remmber which bins were unvisted
			unvisitedBins = IsZero(dwellCounts);

			//ok now we do the smoothing
			smoothedDwellCounts = GetSmoothed(dwellCounts,nBinsX,nBinsY,desiredSmoothingW);

		}
		
		var GetSpikePosInd = function(){	
			//after loading a new tet and/or pos file we know tetTimes and posFreq and can thus express each spike time as an index into the pos array
            spikePosInd = new Uint32Array(spikeTimes.length);
			
			var factor = 1/1000 * posFreq;
    		for(var i=0;i<spikePosInd.length;i++)
    			spikePosInd[i] = spikeTimes[i]*factor; //integer result, so implicitly the floor 
			
		}

        var SetTetData = function(tetTimesBuffer,N,expLenInSeconds_val){
            if(!N){
				spikeTimes = null;
				spikePosInd = null;
				spikePosBinXY = null;
				spikePosBinDir = null;
				unvisitedBins = null;
				smoothedDwellCounts = null;
				smoothedDirDwellCounts = null;
				expLenInSeconds = null;
				return;
			}
						
        	spikeTimes = new Uint32Array(tetTimesBuffer);
			expLenInSeconds = expLenInSeconds_val;
			
			//Ok, now we have tet data. Do we already have pos data, and what about cut data?
            if(posFreq != null){ 
                GetSpikePosInd();
				CachePosBinIndsAndDwellMap();
				CachePosBinIndsAndDwellMap_Dir();
				QueueAllSlotsLazy(); //if we don't have a cut yet this does nothing
			}
    
        }
        
        var SetPosData = function(buffer,N,posFreq_val,pixPerM_val,scale_spikes_plot_val,max_vals_val,dirBuffer){
			//reads pos pixel coordinates

            ClearQueue(); 
			desiredPosDataId++; 
            if(!N){
                posFreq = null;
				spikePosInd = null;
				posValXY = null;
				posBinXY = null;
				posValDir = null;
				posBinDir = null;
                spikePosBinXY_b = null;
				spikePosBinXY = null;
				spikePosBinDir = null;
				unvisitedBins = null;
				smoothedDwellCounts = null;
				smoothedDirDwellCounts = null;
                scale_spikes_plot = null;
                return;
            }
            posFreq = posFreq_val;
            pixPerM = pixPerM_val;
            max_vals = max_vals_val;
            scale_spikes_plot = scale_spikes_plot_val;
			
			posValXY = new Int16Array(buffer);
			posValDir = new Float32Array(dirBuffer);
			
			//Ok, now we have pos data. Do we already have tet data, and what about cut data?
            if(spikeTimes){
                GetSpikePosInd();
				CachePosBinIndsAndDwellMap();
				CachePosBinIndsAndDwellMap_Dir();
				QueueAllSlotsLazy(); //if we don't have a cut yet this does nothing
			}
    
        }

		var GetGroupRatemap = function(slot){
			if(smoothedDwellCounts == null) // if we do have smoothedDwellCounts then we will have everything else we need too
				return;

			var cutInds = slot.inds;

			var groupPosIndsXY = pick(spikePosBinXY,cutInds); //spikePosBinXY was stored as 2byte blocks, which is what we want here
			var spikeCounts = hist_2(new Uint8Array(groupPosIndsXY.buffer),nBinsX,nBinsY); //now we treat it as 1 byte blocks
			spikeCounts[0] = 0; //it's the bad bin, remember, TODO: something better than this

			var smoothedSpikeCounts = GetSmoothed(spikeCounts,nBinsX,nBinsY,desiredSmoothingW);
			var ratemap = rdivideFloat(smoothedSpikeCounts,smoothedDwellCounts)
			useMask(ratemap,unvisitedBins);

			var max_map = max(ratemap);
			var im = ToImageData(ratemap,max_map);
			slot.cmPerBin = desiredCmPerBin;
            slot.smoothingW = desiredSmoothingW;
			slot.posDataId = desiredPosDataId;
			main.ShowIm(im,max_map*posFreq, cutInds.length/expLenInSeconds,slot.num, [nBinsX,nBinsY], slot.generation,IM_RATEMAP,[im]);

		}
		var GetGroupRatemap_Dir = function(slot){
			var cutInds = slot.inds;

			var groupPosIndsDir = pick(spikePosBinDir,cutInds); 
			var spikeCounts = hist_1(groupPosIndsDir,nBinsDir+1);
			spikeCounts[0] += spikeCounts[nBinsDir];
			spikeCounts = spikeCounts.subarray(0,nBinsDir);

			var smoothedSpikeCounts = spikeCounts; //TODO: smoothing
			var ratemap = rdivideFloat(smoothedSpikeCounts,smoothedDirDwellCounts)
			//var im = ToImageData(ratemap); //TODO: make a proper plotting function for dir data
			
			//scale ratemap to have max 1...(for easy plotting)
			var f = 1/max(ratemap);
			for(var i=0;i<ratemap.length;i++)
				ratemap[i] *=f; 
			// replace nans with zero..TODO: this isn't right there are problems..!
			for(var i=0;i<ratemap.length;i++)
				ratemap[i] = isNaN(ratemap[i]) ? 0 : ratemap[i];
				
			slot.degPerBin = desiredDegPerBin;
			main.PlotDirData(ratemap.buffer, slot.num, slot.generation,IM_RATEMAP_DIR,[ratemap.buffer]);
		}
				
		var ToImageData = function(map,max_map){
			//we use PALETTE which is a Uint32Array, though really the underlying data is 4 bytes of RGBA

			var im = new Uint32Array(map.length);

			 //for binning, we want values on interval [1 P], so use eps (lazy solution):
			var eps = 0.0000001;
			if(max_map == 0){
				for(var i=0;i<map.length;i++)
					im[i] = unvisitedBins[i]? PALETTE[0] : PALETTE[1];
			}else{
				var factor = (PALETTE.length-1)/(max_map*(1+eps));
				for(var i=0;i<map.length;i++)
					im[i] = unvisitedBins[i]? PALETTE[0] : PALETTE[1+Math.floor(map[i]*factor)];
			}
			return im.buffer; //this is how it's going to be sent back to the main thread
		}

		var PlotPoint = function(im,W,H,x,y,s,color){
			/* sets a square point of size s x s in image im, with dimensions WxH to the value specified by color */
			var a_start = y<s/2 ? 0 : y-s/2;
			var a_end = y +s/2 > H ? H : y+s/2;
			var b_start = x<s/2 ? 0 : x-s/2;
			var b_end = x +s/2 > W ? W : x+s/2;
			
			for(var a=a_start;a<a_end;a++)for(var b=b_start;b<b_end;b++)
					im[a*W + b] = color; 
		}
		
		var PlotPoint2 = function(totals,counts,W,H,x,y,s,val){
			/* This is like PlotPoints, but it takes two input "images", one which will accumulate counts and one
			which will accumulate values, they can thus be divided at the end to get means. */
			var a_start = y<s/2 ? 0 : y-s/2;
			var a_end = y +s/2 > H ? H : y+s/2;
			var b_start = x<s/2 ? 0 : x-s/2;
			var b_end = x +s/2 > W ? W : x+s/2;
			
			for(var a=a_start;a<a_end;a++)for(var b=b_start;b<b_end;b++){
					totals[a*W + b] += val; 
					counts[a*W + b] += 1;
			}
		}
		var RenderSpikesForPath = function(color,slot_num,slot_generation,asMeanT){
			// TODO: implement a queue so we can cancel all but most recent ...doesn't really seem to be needed actually.
            
			var s = slots[slot_num]
			if(!s || s.generation != slot_generation)
				return; // TODO: should push this render back on to the local queue for when we do have the slot inds
				
			var groupPosIndsXY = pick(spikePosBinXY_b,s.inds); //spikePosBinXY_b was stored as 2byte blocks, which is what we want here
			var nSpks = groupPosIndsXY.length;
			groupPosIndsXY = new Uint8Array(groupPosIndsXY.buffer) // now use it as (x,y), 1 btye each
			
            var W = Math.ceil(scale_spikes_plot*max_vals[1]);
            var H = Math.ceil(scale_spikes_plot*max_vals[0]);
            
			if(asMeanT){
				// Here we accumulate 1s for each spike marker in 2d (a 4x4 square), and separately accumulate spike times for the same marker
				// Then divide the times by the counts to get the mean.  Finally we apply a pallete to the result.
				
				var counts = new Uint32Array(W*H);
				var totalTimes = new Float32Array(W*H);
				var groupSpikeTimes = pick(spikeTimes,s.inds);
				for (var i=0;i<nSpks;i++)
					PlotPoint2(totalTimes, counts, W, H, groupPosIndsXY[i*2+0], groupPosIndsXY[i*2+1], 4, groupSpikeTimes[i]);
				var meanTimes = totalTimes; //we're going to do the division in place, so adopt a new variable name now...
				rdivideFloatInPlace(meanTimes,counts);
				
				var factor = 256/1000/expLenInSeconds; //calculating colormap lookup factor
				var im = counts; //we reuse the memory for the counts array, but read from it as we go...
				for(var i=0;i<im.length;i++)
					im[i] = counts[i] ? PALETTE_B[Math.floor(meanTimes[i] * factor)] : 0;  //apply colormap, leaving 0-alpha in pixels with no counts
				
			}else{
				// This is the normal group sticker color plotting
				var im = new Uint32Array(W*H);
				for (var i=0;i<nSpks;i++)
					PlotPoint(im,W,H,groupPosIndsXY[i*2+0],groupPosIndsXY[i*2+1],4,color)			
			}
			main.ShowIm(im.buffer,-1,-1,slot_num,[W,H],slot_generation,IM_SPIKES_FOR_PATH,[im.buffer]);
            
		}
	};
	// ==== END OF WORKER ==========================
	
	var cCut = null;
	var show = [0,0];
	var workerSlotGeneration = []; //for each slot, keeps track of the last generation of immutable that was sent to the worker
	var meanTMode = false;
	var desiredCmPerBin = 2.5;
	var desiredSmoothingW = 2;
	var desiredDegPerBin = 6;
	var sintable = null;
	var costable = null;
			
	var LoadTetData = function(N_val, tetTimes,expLenInSeconds){
        workerSlotGeneration = [];
		if(!N_val){
			theWorker.SetTetData(null) //this clears the ratemap queue, clears the cut, and clears the stuff cached for doing ratemaps in future
			//TODO: decide whether we need to send null canvases
			return;
		}
		tetTimes = M.clone(tetTimes); //we need to clone it so that when we transfer ownsership we leave a copy in this thread for other modules to use
		
		theWorker.SetTetData(tetTimes.buffer,N_val,expLenInSeconds,[tetTimes.buffer]);

	}

	var LoadPosData = function(N_val, buffer,timebase,pixPerM,scale_spikes_plot,max_vals,dirData){
		if(!N_val){
			theWorker.SetPosData(null) //this clears the ratemap queue, clears the cut, and clears the stuff cached for doing ratemaps in future
			//TODO: decide whether we need to send null canvases
			return;
		}
		buffer = M.clone(buffer); //we need to clone it so that when we transfer ownsership we leave a copy in this thread for other modules to use
		dirData = M.clone(dirData.buffer); //this too
		theWorker.SetPosData(buffer,N_val,timebase,pixPerM,scale_spikes_plot,max_vals,dirData,[buffer,dirData]);

	}
	
	
	var PlotDirData = function(dataBuffer,slotInd,generation,imType){
	    var S = 100; //size in pix
		var data = new Float32Array(dataBuffer);
		var $canvas = $("<canvas width='" + S + "' height='" + S + "' />");
        var ctx = $canvas.get(0).getContext('2d');
		ctx.beginPath();
    	ctx.strokeStyle = "RGB(0,0,0)";
		
    	var i = 0;
    	ctx.moveTo(sintable[i]*S/2*data[i]+S/2,costable[i]*S/2*data[i]+S/2);
		for(;i<data.length;i++)
			ctx.lineTo(sintable[i]*S/2*data[i]+S/2,costable[i]*S/2*data[i]+S/2);
		i = 0;
		ctx.lineTo(sintable[i]*S/2*data[i]+S/2,costable[i]*S/2*data[i]+S/2);
		ctx.stroke();   
		CanvasUpdateCallback(slotInd,TILE_CANVAS_NUM2,$canvas); //send the plot back to main
	}
	
	var ShowIm = function(imBuffer,maxRate,meanRate,slotInd,sizeXY,generation,imType){
        var $canvas = $("<canvas width='" + sizeXY[0] + "' height='" + sizeXY[1] + "' />");
        var ctx = $canvas.get(0).getContext('2d');

		var imData = ctx.createImageData(sizeXY[0],sizeXY[1]);
		imData.data.set(new Uint8ClampedArray(imBuffer));
		ctx.putImageData(imData, 0, 0);
		
		switch(imType){
			case IM_RATEMAP:
				if(maxRate > 0) 
					CutSlotLog(slotInd,"Max spatial rate: " + Math.round(maxRate*10)/10 + "Hz. Mean rate: " + Math.round(meanRate*10)/10 + "Hz","rate");
				CanvasUpdateCallback(slotInd,TILE_CANVAS_NUM,$canvas); //send the plot back to main
				break;
			case IM_SPIKES_FOR_PATH:
				$canvas.toggleClass("poslayer",true);
				SpikeForPathCallback($canvas);  //send the plot back to main
				break;
		}
			
    }

    var SlotsInvalidated = function(newlyInvalidatedSlots,isNewCut){ // this = cut object

        if(this == null && cCut == null)
            throw(new Error ("SlotsInvalidated ratemap with null cut"));

        if(this != null)
            cCut = this;

        if(!show[0])
            return; //we only render when we want to see them

		if(isNewCut){
			workerSlotGeneration = [];
			theWorker.ClearCut();
		}

		for(var s=0;s<newlyInvalidatedSlots.length;s++)if(newlyInvalidatedSlots[s]){
			var slot_s = cCut.GetImmutableSlot(s);

            if(!slot_s.inds || slot_s.inds.length == 0){
                if(isNum(workerSlotGeneration[s])){
                    CanvasUpdateCallback(s,TILE_CANVAS_NUM,null); 
                    theWorker.SetImmutable(s,null);
                    workerSlotGeneration[s] = null; 
                }
                continue; // immutable is empty or deleted
            }

            if(workerSlotGeneration[s] == slot_s.generation)
				continue; //worker already has this slot, there is no reason to send it again here

			var inds = M.clone(slot_s.inds); //we need to clone these before transfering them, in order to keep a copy on this thread
			
			theWorker.SetImmutable(inds.buffer,s,slot_s.generation,[inds.buffer]);
			workerSlotGeneration[s] = slot_s.generation;
			// Worker will hopefully come back with a ShowIm event for this slot 
		}

	}


	var SetShow = function(v){
		if(show[0] ==v[0] && show[1] == v[1])
			return;
		show = v.slice(0);
        if(!cCut)
            return;
		if(v[0] || v[1]){
        	SlotsInvalidated.call(null,M.repvec(1,cCut.GetNImmutables())); //invalidate all slots
		}else{
			if(!v[0]) for(var i=0;i<workerSlotGeneration.length;i++)
				CanvasUpdateCallback(i,TILE_CANVAS_NUM,null);
			if(!v[1]) for(var i=0;i<workerSlotGeneration.length;i++)
				CanvasUpdateCallback(i,TILE_CANVAS_NUM2,null);
			if(!v[0] && !v[1]){
				//TODO: tidy up this case or at least check it's correct
				workerSlotGeneration = [];
				theWorker.ClearCut(); //clears old cut TODO: maybe we can keep the data safely in the worker in case we want to do show again
			}
		}
	}
	
	var SetBinSizeDeg = function(v,viaSlider){
		//TODO: have a slider
		
		theWorker.SetBinSizeDeg(v);
		desiredDegPerBin = v;
		
		//Update trig tables for plotting
		var nBins = 360/v;
		sintable = new Float32Array(nBins);
		costable = new Float32Array(nBins);
		var pi = 3.14159265;
		for(var i=0; i<nBins;i++){
			sintable[i] = Math.sin((i+0.5)*v/180*pi);
			costable[i] = Math.cos((i+0.5)*v/180*pi);
		}

	}
	
	var SetCmPerBin = function(v,viaSlider){
		$binSizeVal.text(v + " cm")
		desiredCmPerBin = v;
		theWorker.SetBinSizeCm(v); //the worker will send back one hist for each slot that it has previously been sent
		if(viaSlider !== true)
			$binSizeSlider.get(0).value = v;
	}
    var SetSmoothingW = function(v,viaSlider){
		if(v == 0)
			$smoothingVal.text("off");
		else if(v == 1)
			$smoothingVal.text("(2+1) by (2+1) bins");
		else
			$smoothingVal.text("(2x" + v + "+1) by (2x" + v + "+1) bins");
        desiredSmoothingW = v;
        theWorker.SetSmoothingW(v);
        if(viaSlider !== true)
    		$smoothingSlider.get(0).value = v;
    }
	var RenderSpikesForPath = function(g){
	    var color = PALETTE_FLAG[g];
		var slot = cCut.GetGroup(g,true);
		theWorker.RenderSpikesForPath(color,slot.num,slot.generation,meanTMode);
	}
	
	var FileStatusChanged = function(status,filetype){
		/* This function's job is to pass on data as soon as possible to the worker, and/or send a signal to 
		 clear invaldidated data as soon as possible.  The worker will make sure that whatever order things
		 arrive in it will always do as much work as possible, only stopping when it is missing a required file. */
		 
		if(filetype == null){
			if(status.tet < 3)
				LoadTetData(null);
			
			if(status.pos < 3)
				LoadPosData(null);
			
			if(status.cut < 3){
				cCut = null;
				theWorker.ClearCut();
			}
		}
		
		if(filetype == "tet"){
			LoadTetData(ORG.GetN(),ORG.GetTetTimes(),parseInt(ORG.GetTetHeader().duration));
		}
		
		if(filetype == "pos"){
			var posHeader = ORG.GetPosHeader();
            
            // work out scale factor for spike pos plot (in spatial panel)
            var xs = POS_W/(parseInt(posHeader.max_vals[1])-0);
            var ys = POS_H/(parseInt(posHeader.max_vals[0])-0);
                
			LoadPosData(parseInt(posHeader.num_pos_samples), ORG.GetPosBuffer(),
                        parseInt(posHeader.timebase),parseInt(posHeader.units_per_meter),
                        xs<ys? xs: ys /*min of the two*/,
                        posHeader.max_vals,
						ORG.GetDir());
			
		}
			
	}

	var SetRenderMode = function(v,g){
		//currently this only applies to the spikes plot
		 switch(v){
            case 2:
                meanTMode = true;
                break;
            default:
                meanTMode = false;
        }
		
		if(g>0 || g==0)
			RenderSpikesForPath(g);
	}
	
	
	
	var theWorker = BuildBridgedWorker(workerFunction,
										["SetPosData*","SetTetData*","SetBinSizeCm","SetSmoothingW",
                                            "SetImmutable*","RenderSpikesForPath", "ClearCut","SetBinSizeDeg"],
										["ShowIm*","PlotDirData*"],[ShowIm,PlotDirData],
										WORKER_CONSTANTS);
	//console.log("ratemap BridgeWorker is:\n  " + theWorker.blobURL);


	$binSizeSlider.on("change",function(e){SetCmPerBin(this.value,true);});
	$smoothingSlider.on("change",function(e){SetSmoothingW(this.value,true);});
	SetBinSizeDeg(6);
    
	ORG.addEventListener('cut_change',SlotsInvalidated);
	ORG.addEventListener('file_status_change',FileStatusChanged);
	modeChangeCallbacks.push(SetRenderMode);
	
	
	return {
		SetShow: SetShow,
		SetCmPerBin: SetCmPerBin,
		GetCmPerBin: function(){return desiredCmPerBin;},
        GetSmoothingW: function(){return desiredSmoothingW;},
        SetSmoothingW: SetSmoothingW,
		SetBinSizeDeg: SetBinSizeDeg,
		GetBinSizeDeg: function(){return desiredDegPerBin;},
		RenderSpikesForPath: RenderSpikesForPath,
		SetRenderMode: SetRenderMode
	}

}(T.PAR.BYTES_PER_SPIKE,T.PAR.BYTES_PER_POS_SAMPLE,T.PAR.POS_NAN,
  T.CutSlotCanvasUpdate, T.CutSlotLog, T.CANVAS_NUM_RM,T.CANVAS_NUM_RM_DIR,T.ORG,
  T.POS_PLOT_WIDTH,T.POS_PLOT_HEIGHT,T.SpikeForPathCallback,
  new Uint32Array(T.PALETTE_FLAG.buffer),new Uint32Array(T.PALETTE_TIME.buffer),
	$('#rm_binsize_slider'),$('#rm_smoothing_slider'),$('#rm_binsize_val'),$('#rm_smoothing_val'),T.modeChangeCallbacks)

