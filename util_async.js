/*
	This works in webworkers as well as on main thread, but not in Firefox, see:
		http://caniuse.com/#feat=channel-messaging
	What we have here is basically a poor cousin of the following polyfill:
		https://github.com/YuzuJS/setImmediate
	-------------------------------------------------------------------------
	Example:
	-------
	
	function Test(x,y,z){
		console.log("x,y,z=" + x + "," + y + "," + z);
	}

	task = async(Test, 8, "man", 99);

	// somehwere else...
	task.cancel();

	// or ...
	async.cancel_all();

	-----------------------------------------------------------------------------
	This is supposed to work like setTimeout(...,0), i.e. it adds a new task to
	the end of the event queue.  The reason it is better than setTiemout is that
	setTimeout inserts a mandatory minimum delay of 4ms (supposedly).  On the
	main thread, you can apparently use postMessage to send a message to self,
	which gets put on the event queue, but in webworkers this is not possible.
	Thus we have ended up using MessageChannel.  Perhaps it would be nice to
	fallback to the above mentioned alternaitves if MessageChannel is not available.

	DM, Apr 2015.
*/
"use strict";
var async = (function(){
	var last_id = 0;
	var callbacks = {};
	var args = {};
	var channel = new MessageChannel();
	channel.port2.onmessage = function(e){
		var id = e.data;
		if(id in callbacks){
			callbacks[id].apply(null,args[id])
			delete callbacks[id];
			delete args[id];
		}
	}
	var cancelable = function(id){		
		this.id = id;
		return this;
	}
	cancelable.prototype.cancel = function(){
		delete callbacks[this.id];
		delete args[this.id];
	}

	var ret = function(callback /*, arg_1, arg_2,... */){
		/* This is the function that the user calls */
		var id = ++last_id;
		callbacks[id] = callback;
		args[id] = Array.prototype.slice.call(arguments,1);
		channel.port1.postMessage(id)
		return new cancelable(id);
	}
	ret.cancel_all = function(){
		callbacks = {};
		args = {};
	}

	return ret;
})();
