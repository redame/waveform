"use strict";
function extend(/*dest, src_1, src_2, ... */) {
  	var ret = arguments[0];
	for (var i=1; i<arguments.length; i++) 
		for (p in arguments[i]) 
			if (arguments[i].hasOwnProperty(p)) 
				ret[p] = arguments[i][p];
	  	return ret;
}