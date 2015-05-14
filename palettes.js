
/*
    PALETTES:
       FLAG - uint32 array of length 256, grey, blue, green, red, ...., black, black, black
       TIME - uint32 array of length 256, red-to-green
       FLAG_CSS - same as FLAG but css colour strings rather than uint32s
       FLAG_CSS_TEXT - when using FLAG_CSS as the background color, use this as the foreground, text, color
*/

PALETTES = {};

PALETTES.FLAG = function(){
        var data = new Uint8Array(256*4);
        for(var i=0;i<256;i++)
    		data[i*4+3] = 255; //alpha to full opaque
        data[0*4+0] = 190;    data[0*4+1] = 190;    data[0*4+2] = 190; //was 220 for all three
        data[1*4+2] = 200;
    	data[2*4+0] = 80;	data[2*4+1] = 255;
        data[3*4+0] = 255;
        data[4*4+0] = 245;	data[4*4+2] = 255;
    	data[5*4+1] = 75;	data[5*4+1] = 200;	data[5*4+2] = 255;
        data[6*4+1] = 185;
    	data[7*4+0] = 255;	data[7*4+1] = 185;	data[7*4+2] = 50;
        data[8*4+1] = 150;	data[8*4+2] = 175;
        data[9*4+0] = 150;	data[9*4+2] = 175;
    	data[10*4+0] = 170;	data[10*4+1] = 170;
    	data[11*4+0] = 200;
    	data[12*4+0] = 255;	data[12*4+1] = 255;
    	data[13*4+0] = 140;	data[13*4+1] = 140;	data[13*4+2] = 140;
    	data[14*4+1] = 255; data[14*4+2] = 235;
    	data[15*4+0] = 255; data[15*4+2] = 160;
    	data[16*4+0] = 175; data[16*4+1] = 75; data[16*4+2] = 75;
    	data[17*4+0] = 255; data[17*4+1] = 155; data[17*4+2] = 175;
    	data[18*4+0] = 190; data[18*4+1] = 190; data[18*4+2] = 160;
    	data[19*4+0] = 255; data[19*4+1] = 255; data[19*4+2] = 75;
    	data[20*4+0] = 154; data[20*4+1] = 205; data[20*4+2] = 50;
    	data[21*4+0] = 255; data[21*4+1] = 99; data[21*4+2] = 71;
    	data[22*4+1] = 255; data[22*4+2] = 127;
    	data[23*4+0] = 255; data[23*4+1] = 140;
    	data[24*4+0] = 32; data[24*4+1] = 178; data[24*4+2] = 170;
    	data[25*4+0] = 255; data[25*4+1] = 69; 
    	data[26*4+0] = 240; data[26*4+1] = 230; data[26*4+2] = 140;
    	data[27*4+0] = 100; data[27*4+1] = 149; data[27*4+2] = 237;
    	data[28*4+0] = 255; data[28*4+1] = 218; data[28*4+2] = 185;
    	data[29*4+0] = 153; data[29*4+1] = 50; data[29*4+2] = 204;
    	data[30*4+0] = 250; data[30*4+1] = 128; data[30*4+2] = 114;
        return new Uint32Array(data);
    }();

PALETTES.FLAG_CSS = function(){
	var ret = [];
	
	for(var i=0;i<PALETTES.FLAG.length;i+=4)
		ret.push('rgb(' + PALETTES.FLAG[i] +"," +PALETTES.FLAG[i+1] +","+ PALETTES.FLAG[i+2]+")") //maybe a bit inefficient but it's only 256 values so whatever
	return ret;
}();

PALETTES.FLAG_CSS_TEXT = function(){
	var black_list = [0,2,3,4,5,6,7,10,12,13,14,15,17,18,19,20,21,22,23,25,26,27,28,30]; //these group numbers are black, all others are white
	
	var ret = [];
	for(var i=0;i<PALETTES.FLAG.length/4;i++)
		ret.push( black_list.indexOf(i) == -1 ? '#FFF' : '#000');
		
	return ret;
}();

PALETTES.TIME = function(){
	var data = new Uint8Array(256*4);
        for(var i=0;i<256;i++){
			data[i*4 +0] = 255-i;  //decreasing red
			data[i*4 +1] = i; //increasing green
		    data[i*4+3] = 255; //set alpha to opaque
		}
		return new Uint32Array(data.buffer);
}();

