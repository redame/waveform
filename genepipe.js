
"use strict"
/* http://google.github.io/traceur-compiler/demo */

let sub_from_str = (function(){
  let cache_ = new Map();
  return function(str){
    if (!cache_.has(str)){
      if(str == 'i')
          cache_.set(str,function(i){return i;})
      //TODO: support things like "i+1" and "2i" etc.
        }
    return cache_.get(str);
  }
})();

class Gene {
	
  constructor(name,directBeforeNames = [],updateFunction,{repeat=-1}={}){
    this.name = name;
    this.directBeforeNames = directBeforeNames.map(x=>x.split(" ")[0]);
	this.directBeforeSub = directBeforeNames.map(x=> sub_from_str(
						x.split(" ").slice(1).join("") //get everything after the first space, with subsequent spaces removed
						))	
    this.repeat = repeat;
	
    //these things will be set when genome is built
    this.directBefore = []; 
    this.directAfter = [];
    this.id_ = -1;
	if(updateFunction)
	    console.log(updateFunction.toString())
  }
  set id(v){
	if(this.id_ != -1)
		throw "can only set id once"
	else
		this.id_ = v;
  }
  get id(){
	return this.id_;
  }

}

class GenePipe {
   constructor() {
    this.genome = [];
    this.nGenes = 0;
    this.geneFromName = new Map();
  }	
  
  AddGene(name,...geneConstructorArgs){
  			name = name.split(" ")[0];
  			let newGene = new Gene(name,...geneConstructorArgs);
  			this.geneFromName.set(newGene.name,newGene);
  			this.nGenes++;
 		}

  BuildGenome(){ 
    let geneIsStackedFromName = new Set();
    let geneFromName = this.geneFromName
    let geneFromId = this.genome;
    
    // now we have all genes we can create the directBefore array for each gene
    for(let [,g] of geneFromName)
      g.directBefore = g.directBeforeNames.map(x => {
     	let b = geneFromName.get(x);
        b.directAfter.push(g);
		return b;
      });
    
    // we are going to use this simple recursion to put genes onto a stack, such that every gene
    // is pushed on later than all of its dependencies
    let recurseAddToStack = function(g){
      for(let d_name of g.directBeforeNames) {
          if(!geneIsStackedFromName.has(d_name))
			recurseAddToStack(geneFromName.get(d_name));
      }
		g.id = geneFromId.length;
     	geneFromId.push(g);
        geneIsStackedFromName.add(g.name);
	 }
    
    // do the recursion
    for(let [,g] of geneFromName)
      if(!geneIsStackedFromName.has(g.name))
    	recurseAddToStack(g);
  	
  }
  
  ShowGenome(el){
	if(!this.rendered){
		let genome = this.genome;
		Polymer.import(['dagre-d3.html'],function(){
				let viz = document.createElement('dagre-d3');
				el.parentElement.replaceChild(viz,el)
				viz.Render(genome);
		});
	}
	this.rendered=true;
  }

}


///#########################################################################///
///#########################################################################///
///#########################################################################///

let G = new GenePipe();
window.G = G;


let N_CUT_SLOTS = 200;

G.AddGene('pos_file',
		['exp_name'],
	function (exp_name){
		// TODO: get the pos file associated with the new exp
	})
	
G.AddGene('set_header',['set_file'])
G.AddGene('time_info',['set_header'])//this is the "hh:mm to hh:mm" string
G.AddGene('speed',['xy'])
G.AddGene('speed_hist',['speed','pos_mask'])
G.AddGene('set_file',
		['exp_name'],
	function (exp_name){
		//TODO: get the set file associated with the new exp...what if there is no file and it later appears?
	})
	
G.AddGene('tet_num');

G.AddGene('cut',[],
	function (){
		//TODO: get the cut file associated with the new exp-tet...hmm this is more complciated.
	})
	
G.AddGene('c_inds i',['cut'],
	function (cut){
		//TODO: represent a set of cut_inds
	},
	{repeat: N_CUT_SLOTS})
	
	
G.AddGene('c_group i',['cut'],
	function(cut){
		//TODO: get the group number for the cut inds
	},
	{repeat: N_CUT_SLOTS});

G.AddGene('dir_bin_inds_full',['dir']);
G.AddGene('dir_bin_inds',['dir_bin_inds_full','pos_mask']);
G.AddGene('dir_dwell',['dir_bin_inds']);
G.AddGene('spike_dir_bin_inds',['spike_pos_inds','dir_bin_inds_full']);
G.AddGene('c_dir_bin_inds_full i',['spike_dir_bin_inds','c_inds i']);
G.AddGene('xy_bin_inds_full',['xy']); 
G.AddGene('xy_bin_inds',['xy_bin_inds_full','pos_mask']); 
G.AddGene('spike_xy_bin_inds',['xy_bin_inds_full','spike_pos_inds']);
G.AddGene('xy_dwell',['xy_bin_inds']);
G.AddGene('c_dir_bin_inds i',['c_dir_bin_inds_full i'],undefined,{repeat: N_CUT_SLOTS});
G.AddGene('c_dir_rm i',['c_dir_bin_inds i','dir_dwell'],undefined,{repeat: N_CUT_SLOTS});
G.AddGene('c_xy_bin_inds_full i',['c_inds i','spike_xy_bin_inds'],undefined,{repeat: N_CUT_SLOTS})

G.AddGene('c_xy_bin_inds i',['c_inds i','c_xy_bin_inds_full','spike_mask'],undefined,{repeat: N_CUT_SLOTS});

G.AddGene('c_xy_rm i',['c_xy_bin_inds','xy_dwell'],
	function(c_pos_inds){
		//TODO:
	},
	{repeat: N_CUT_SLOTS});
	
G.AddGene('pos_mask')
G.AddGene('spike_mask',['pos_mask'])

G.AddGene('pos_header',
	['pos_file'],
	function (pos_file){
		//TODO: read the header from file into a key-value object
	})
	
G.AddGene('tet_header',
	['tet_file'],
	function (tet_file){
		//TODO: read the header from file into a key-value object
	})

G.AddGene('tet_buffer',
	['tet_file'],
	function (tet_file){
		//TODO: read the data part of the file into a buffer...might want to stream this?
	})
	
G.AddGene('tet_times',
	['tet_header','tet_buffer'],
	function (tet_header,tet_buffer){
		//TODO: read the tet times from the fileheader from file into a key-value object
	})
	
G.AddGene('tet_amps',
	['tet_header','tet_buffer'],
	function (tet_header,tet_buffer){
		//TODO: compute the tet amps
	})
	
G.AddGene('gl_v_data',
	['tet_header','tet_buffer'],
	function (tet_header,tet_buffer){
		//TODO: generate the voltage buffer data...might want to stream this, either as a continuation from streamed tet_file or as an independant stream
	})
	
G.AddGene('exp_name')

G.AddGene('gl_c_data',
	['cut'],
	function (cut){
		//TODO: generate the cut data for gl rendering
	})
	
G.AddGene('tet_file',
    ['tet_num','exp_name'],
    function(tet_num,exp_name){
        //TODO: find the tetrode file immutable
    });
	
G.AddGene('xy',
    ['pos_header','pos_buffer']
)

G.AddGene('spike_pos_inds',['tet_times']);

G.AddGene('dir',['xy']) // May want to produce xy and dir together.

G.AddGene('c_waves',['gl_c_data','gl_v_data'])

G.AddGene('pos_buffer',['pos_file'])

G.AddGene('c_spike_times_full i',['tet_times','c_inds'],undefined,{repeat:N_CUT_SLOTS})
G.AddGene('c_spike_times i',['c_spike_times_full i','c_inds','spike_mask'],undefined,{repeat:N_CUT_SLOTS})

G.AddGene('c_t_ac i',['c_spike_times'],undefined,{repeat:N_CUT_SLOTS})


G.BuildGenome();


