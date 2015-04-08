"use strict";
var simple_callbacks = function(){
	/*
	  This is amassively trimmed down version of jquery's "callbacks". 
	  DM, Apr 2015.
	*/
	var list = [];
	return {
		add: function(foo){
			list.push(foo);
		},
		remove: function(foo){
			var i = list.indexOf(foo);
			list.splice(i,1);
		},
		fireWith: function(context, args){
			args = args || [];
			args = [ context, args.slice ? args.slice() : args ];
			for (var i=0; i<list.length; i++)
				list[i].apply(context,args)
		}
	};
};