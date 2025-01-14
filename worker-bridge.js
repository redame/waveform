var BuildBridgedWorker = function(workerFunction,workerExportNames,mainExportNames,mainExportHandles,constantsKV){
	//workerFunciton is a function, the interior of which will be turned into a string and used as a worker
	//workerExportNames should be an array of string function names available to main 
	//mainExportNames should be an array of string function names available to worker
	//mainExportHandles should be an array of the actual functions corresponding to the functions in main
	//for both Names arrays, if the function name ends in an asterisk it means that the last argument passed is going to be an array of ArrayBuffers
	// constantsKV should be an object, the keys of which will become vars and the values of which will be JSONified and assigned to the vars
	//    this will then be placed at the top of the worker code, so can be used as constants or as modifiable values.
	// 
	//The result of all this work is that inside the worker we can call main.SomeMainFunction(thing,otherthing,more,[buffer1,buffer2])
	//and in main we can call myWorker.SomeWorkerFunction(hello,world,[buffer1,buffer2])
	//
	
	var extraWorkerTopStr = []; //we will fill this with the constantsKV
	var baseWorkerStr = workerFunction.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1]; //this is the main body of the function
	var extraWorkerStr = []; //this is all the extra stuff for ease of briding
	
	if(constantsKV){
		var keys = Object.keys(constantsKV);
		for (var i=0;i<keys.length;i++)
			extraWorkerTopStr.push('var ' + keys[i] + " = " + JSON.stringify(constantsKV[keys[i]]) + ";");
	}


	
	// build a string for the worker end of the worker-calls-funciton-in-main-thread operation
	extraWorkerStr.push("var main = {};\n");
	for(var i=0;i<mainExportNames.length;i++){
		var name = mainExportNames[i];
		if(name.charAt(name.length-1) == "*"){
			name = name.substr(0,name.length-1);
			mainExportNames[i] = name;//we need this trimmed version back in main
			extraWorkerStr.push("main." + name + " = function(/* arguments */){\n var args = Array.prototype.slice.call(arguments); var buffers = args.pop(); \n self.postMessage({foo:'" + name +  "', args:args},buffers)\n}; \n");
		}else{
			extraWorkerStr.push("main." + name + " = function(/* arguments */){\n var args = Array.prototype.slice.call(arguments); \n self.postMessage({foo:'" + name +  "', args:args})\n}; \n");
		}
	}
	
	// build a string for the worker end of the main-thread-calls-function-in-worker operation
	var tmpStr = [];
	for(var i=0;i<workerExportNames.length;i++){
		var name = workerExportNames[i];
		name = name.charAt(name.length-1) == "*" ? name.substr(0,name.length-1) : name;
		tmpStr.push(name + ": " + name);
	}
	extraWorkerStr.push("var foos={" + tmpStr.join(",") + "};\n");
	extraWorkerStr.push("self.onmessage = function(e){\n");
	extraWorkerStr.push("if(e.data.foo in foos) \n  foos[e.data.foo].apply(null, e.data.args); \n else \n throw(new Error('Main thread requested function ' + e.data.foo + '. But it is not available.'));\n");
	extraWorkerStr.push("\n};\n");
	extraWorkerStr.push("var console = {\nlog:\n function(str){self.postMessage({foo:'console_log',args:[str]})}\n}\n");
	extraWorkerStr.push("var copy_typedarray_to_main = function(x,name){\n var buffer = x.buffer.slice(0);\nself.postMessage({foo: 'copy_typedarray_to_main', args:[buffer,name,x.constructor.name,[buffer]]});\n}");

	var fullWorkerStr = "\n\n/*==== VARS ADDED BY BuildBridgeWorker ==== */\n\n" + 
						extraWorkerTopStr.join("\n") + 
						"\n\n/*==== START OF CUSTOM WORKER CODE ==== */\n\n" +
						baseWorkerStr + 
						"\n\n/*==== ADDITIONAL LOGIC ADDED BY BuildBridgeWorker ==== */\n\n" +
						extraWorkerStr.join("");

	// create the worker
	var url = window.URL.createObjectURL(new Blob([fullWorkerStr],{type:'text/javascript'}));
    var theWorker = new Worker(url);
					  
	// buid a funcion for the main part of worker-calls-function-in-main-thread operation
	theWorker.onmessage = function(e){
		if(e.data.foo == "console_log"){ 
			console.log(e.data.args[0]);
			return;
		}
		if(e.data.foo == "copy_typedarray_to_main"){
			var constructor = window[e.data.args[2]];
			window[e.data.args[1]] = new constructor(e.data.args[0]);
			return;
		}
		var fooInd = mainExportNames.indexOf(e.data.foo);
		if(fooInd != -1)
			mainExportHandles[fooInd].apply(null, e.data.args);
		else
			throw(new Error("Worker requested function " + e.data.foo + ". But it is not available."));
	}
	
	// build an array of functions for the main part of main-thread-calls-function-in-worker operation
	var ret = {blobURL: url};//this is useful to know for debugging if you have loads of bridged workers in blobs with random names
	var makePostMessageForFunction = function(name,hasBuffers){
		if(hasBuffers)
			return function(/*args...,[ArrayBuffer,..]*/){var args = Array.prototype.slice.call(arguments); var buffers = args.pop(); theWorker.postMessage({foo:name,args:args},buffers);}
		else
			return function(/*args...*/){var args = Array.prototype.slice.call(arguments);  theWorker.postMessage({foo:name,args:args});};
	}
	
	for(var i=0;i<workerExportNames.length;i++){
		var name = workerExportNames[i];
		if(name.charAt(name.length-1) == "*"){
			name = name.substr(0,name.length-1);
			ret[name] = makePostMessageForFunction(name,true);
		}else{
			ret[name] = makePostMessageForFunction(name,false);
		}
	}
	
	return ret; //we return an object which lets the main thread call the worker.  The object will take care of the communication in the other direction.
}