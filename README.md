# <a name="wiki"/> Waveform

Daniel decided that browsers are good for rapid design of user-friendly interfaces. This is very much a work in progress.  Note that only Chrome is actively supported. Firefox seems to work okay, but other browsers less so. Feel free to contribute.

#### To use the application do one of the following:
+ go to [d1manson.github.io/waveform](http://d1manson.github.io/waveform) for the latest fairly stable version
+ go to [googledrive.com/...XNVE/dev/](https://googledrive.com/host/0B2QfZjKOj5KxT2wwSFZwRUVXNVE/dev) for the latest (very unstable) dev version
+ [download](https://github.com/d1manson/waveform/archive/master.zip) the code and open index.html in your browser.
+ if you want an older "stable" version you will need to navigate through the git history of the ``hgpages``  branch and download the version you like.  Note that unfortunately no version numbering scheme has been used so there isn't a simple way of reocgnising previous iterations.

#### Screenshots
Example view of the whole application, with a few things labeled:    
![screenshot](/screenshot1.png "screenshot with labels")

Some screenshots of individual features:     

|                                   |                                         |
|:----------------------------------|:---------------------------------------:|
|Merger tool                        | ![mergetool](/mergertool.png)           |
|Splitter tool                      | ![splittertool](/splittertool.png)      |
|Cluster painting tool              | ![paintingtool](/clusterpainting.png)  |        
|Wave rendering in  "density" mode   | ![density](/countmode.png)              |  
|Cluster rendering in "drift" mode  | ![drift](/drift.png)                    |  


#### Quickstart   (... it's short and worth reading!)
**Loading the data.** Open your operating system's file explorer and drag all the files you want into the GUI.  They will automatically be organised in the file panel on the left.  Click on a given experiment (aka "trial") to activate it. You switch tetrodes by selecting one of the numbered buttons to the right of the word "tetrode" at the top of the file panel.  If you have multiple cuts on a given tetrode you can switch cuts by clicking on the cut's name.  By default the most recently modified cut file will be used.

**Viewing the data.**
You can select to view a single channel, ratemap, or temporal autocorrelogram by clicking the relevant button in the main toolbar.  Hold down shift to select multiple views.

**Merge groups.** You can drag a tile onto another tile in order to merge two groups together.  

**Split a group.** Right click a group (and drag) to use the split tool.  This tool lets you specify a time and voltage threshold on which to split up a group (voltage threshold applied on a single channel).   The split is shown when you release the right mouse button, but you can right click again to adjust it. To finalise the split left click on the tilewall outside the two active tiles (or right click the tilewall to cancel the split).

**Cluster paint** The top left of the cluster panel shows the current source and destination groups for cluster painting.  There are two ways of painting a region: either use the left mouse button to select the area you do want to transfer, or use the right mouse button to select an area you don't want to transfer, i.e. transfer everything else. In both cases the region to be transfered is always shown as a transparent green overlay.  There are several ways of select the source and destination groups (use whichever is most convenient for you): (1) left click the relevant group's "sticker" at the top of the cluster panel to select it as the destiation, or right click to select it as the source; (2) click the source/destination buttons that appears when you move the cursor over a group's tile in the tilewall; (3) With your cursor over the group use the shortcuts ``f``/``e`` to select source or destination (this works for the cursor over either the group's sticker, its tile, or its coloured pixels in the cluster plots). For all of the above 3 methods you can select multiple source groups by holding down shift. To increment the destination group use the shorcut ``Enter`` (strictly speaking it's not actually a "shorcut" as there's no other way of doing this at the moment!).

**Reorder the groups.** The main toolbar has two reordering tools: reorder by N sorts the groups by the number of waves in the group; reorder by A sorts the groups by the amplitude of the mean waveform for the group (it uses the first of the currently displayed channels).

**Autocut.** Primative autocut support has been removed from this project. It is recommended that you try using [KlustaKwik](https://github.com/klusta-team/klustakwik), to do so you will need to some kind of script to parse ``tet`` files and output an ``n x m`` plaintext table with ``n`` rows for the ``n`` spikes each with  ``m`` "dimensions".  Typically the "dimensions" will correspond to principle components or amplitude, but you are free to choose any projection of the data that gives good clustering results.  The (very simple) ``.clu`` files output by KlustaKwik are recognised by this GUI, so there is no need to conver to the (also very simple) ``.cut`` format.

**Save the cut.** Drag the cut file from the file panel to your operating system's file explorer.  It will be given the standard name for a cut file.

**Checking for drift**
Using the drift button (shortcut `d`) you can see whether there was any shift in the clusters during the trial.  (see image below for an example).  You can also see whether a particular cell's spatial pattern changed during the trial. 

**Info panes and plot grabbing**
There are several floating info panes (header info, action list, shorcut list etc.) that appear when you move your cursor over the relevant button in the main toolbar.  If you right click the given button it will pin/unpin the info pane, so it will remain even when you move the cursor off the button. These info panes can be dragged around freely.    
To grab a plot, hold down space and then click the plot. This works for tiles in the tilewall, the cluster panel, and the spatial panel.   To close of a grabbed plot or info pane, hold down space again and click the floating pane.    

It is also possible to copy a tile's plots to the system clipboard (e.g. for pasting into an email or note taking application). To to do this, simply press ``ctrl-c`` when one of the groups in the tile wall is "active".  Note that not all programs will correctly interpret the clipboard data - Gmail and Google Docs have been tested and seem to work.

**Reset preferences**
The GUI will in general remember your preferences (i.e. bin size, smoothing, cluster painting brush size etc.).  However there may very occasionally be a problem with this, perhaps caused by an update to the code since your last visit to the page.  If you find the page hasn't loaded properly you should open up the developer tools and go to the "console" tab (press ``F12`` or find the option in your browser's menu).  You should then type the command ``T.ResetAndRefresh()``.  This will clear your preferences and reset the page. If this still doesn't work then subit a bug via report asap (see the navigation the icon on the right here on GitHub).

#### Keyboard shortcuts
+ `k` show list of keyboard shortcuts
+ `escape` open/close the main toolbar.
+ `p` cycle palette. 
+ `ctrl+z` or just `z` undo.
+ `1`, `2`, `3`, `4`, `r`, `t` view channel 1-4, ratemap or temporal-autocorr. Use `shift` to show multiple views (as when using the mouse in the button panel).
+ `d` toggle drift mode rendering of the cluster plots.
+ `f` select group under cursor as source (i.e. "From group") group for cluster painting. Use `shift` to select multiple.
+ `e` select group under cursor as destination (i.e. "Enter into group") group for cluser painting.
+ `Enter` increment destination group number for cluster painting.
+ `s` launch group swap dialog for group under cursor.
+ `Space` hold down `space` and click plots to grab them, or click existing floating dialogues to close them.
+ `+` and `-` change size of cluser plots. (Note that `+` is actually the `=` key.)
+ `?` go to the GitHub page.
+ `a`  do autocut. 
+ `ctrl-c` copy to the system clipboard the info and plots for the group under the cursor.

_Right clicking with a touchpad._ In some cases right clicking can be emulated by holding the `alt` key and left-clicking.


#### Change Log
* Made drop zone a bit fancier.   
* Added a speed histogram to the info ontop of pos, and later added a drift mode rendering.    
* Implemented some post processing for position data together with an info pane to control some of the paramaters.
* Added sliders for ratemap and temporal autocorr paramaters.
* Added copy function.
* Switched to using flex layout and polymer web components.
* Added support for `.clu` files. Also improved the process of assigning cut files to trials. And cut files are now chronologically ordered and the most recent is the default.    
* Optimised parts of the loading process and fixed a few bugs to do with using both mouse buttons.
* Added a raw spike rendering feature to the spatial panel, which also renders mean time in drift mode.
* Added cluster painter tool.
* Added a grabbing feature for easy comparisons across trials/cuts.
* Tidied up the look and feel of the interface.
* Added a new wave rendering mode which shows the densities.
* Created a drift mode for rendering cluster plots.
* Re-worked the `T.ORG` module so that you can now switch cuts/tets/exps more easily.
* Each module now registers its own handlers with `T.ORG` rather than letting `main.js` do it.
* Added the cluster plots (not yet interactive).
* Created some keyboard shortcuts using keymaster.
* Implemented splitter tool. (Separator tool mentioned in change log below no longer exists.)
* Created BridgedWorker function and re-wrote temporal autocorr and ratemap to use it.
* Created temporal autocorr view.
* Webgl-rendering is now much simpler and possibly faster (there are a couple of minor bugs in the new version.)
* Cut now stores immutable data in slots rather than keeping a basic array with one element for each cut group.
* Added double click separator UI.  It's not as helpful as I'd hoped though.
* Restuctured much of the code for dealing with cuts and organising multiple files.  Can now switch between different cuts.
* Added basic ratemap generating code.
* Several sections of code have been restructured to make them more modular and easier to use.
* Can now toggle each channel on and off, by holding ctrl key when selecting channels in the button pane.
* Modified the webgl waveform rendering so that it now renders each channel separately, this simplifies the code and probably ought to be faster. (I'm too sure if it is faster because rendering times are very inconsistent.)
* Implemented (basic) multi-experiment, multi-tetrode functionality. Need to extend this to multi-cut functionality.
* Implemented reorder together with undo function.
* Have implemented an undo panel and undo button.  This is relatively simple for merging, but may be more complicated for other things.
* Have actually implemented merge.  Hooray, you can now use the program for something!
* Have added a button to toggle useage of HTML5 FileSystem.  The main reason for using it is for reloading the page on debugging, probably not that important for other users.</li>
* Have now implemented rendering with WebGl, it's really complicated and doesn't seem to be any faster.  Also it's still pretty rough around the edges.
* Can now display path data in the spatial panel on the left.   The impelementation of this is currently fairly ruidmentary: it only uses the first tracking LED, doesn't do any filtering and may not match the path shown in Tint.
* A heirarchical autoclusering method has been partially implemented. See below. 
* Can now drag cut file back onto the desktop to save it. 

#### Understanding the code

With the exception of `Mlib.js`, `utils.js`, and `bridged-worker.js`, all JavaScript objects are either kept in the namespace `T` or in one of the following sub-namespaces (each of which has its own appropriately named `.js` file):
* `T.ORG` - organizes data files for multiple experiments, multiple tetrodes within the same experiment, and multiple cuts for the same tetrode. To do this it has some interaction with the [DOM](http://www.w3schools.com/htmldom/).  Many of the other modules register listeners on this module using `AddFileStatusCallback`, `AddCutChangeCallback`, and `AddCutActionCallback`.
* `T.CUT` - is a JavaScript psuedo-class that keeps track of the starting state and history of operations performed on a cut.  Whenever the cut is changed, it triggers the callbacks registered with `T.ORG.AddCutChangeCallback` and `T.ORG.AddCutActionCallback`.
* `T.PAR` - this module exposes a number of functions, each of which accepts a file handle to a particular type of file that it knows how to parse into a header and binary data buffer.  In addition, it also exposes some functions for getting at the data in the raw buffers, for example there is a function to get the spike times and spike amplitudes.
* `T.Tool` - this module has heavy DOM interactions, specifically with tiles in the tilewall.  It essentially exposes an interactive way of calling the modification functions for the current cut instance.
* `T.WV` - this module uses [WebGL](https://developer.mozilla.org/en-US/docs/Web/WebGL) to render waveforms.  It is complicated and messy.
* `T.RM` - this module produces ratemaps.
* `T.TC` - this module produces temporal autocorellograms.
* `T.CP` - this module produces cluster plots.
* `T.AC` - this module performs an autocut, the first stage of which uses `T.DM`.
* `T.DM` - this uses WebGL to produce a distance matrix.    
* `T.FS` - this module simplifies the process of using the HTML5 FileSystem APIs, which are currently only available in Chrome.  If the user chooses not to turn on the FileSystem this module will act identically, but behind the scenes everything will be much simpler. (Note that turning on the FileSystem is really only of interest for developers working on the application as they may be refreshing the page a lot.)

The file `Mlib.js`, contains a namespace `M` with some basic functions for doing Matlab style manipulation of arrays.  It is very basic, only the functions that have so far been needed have been coded, and not in a particularly generalized form.  The file, `utils.js`, adds a handful of functions to the global namespace.  Perhaps the most important file is `main.js`; roughly speaking, this is where all the miscellaneous interactive stuff is coded and everything comes together nicely. The file `bridged-worker.js` makes it easier to use HTML5 workers - I was so pleased with this file that I gave it its own [GitHub gist](https://gist.github.com/d1manson/6714892).

If you've never tried to style a `div` with CSS then you would do well to google a basic HTML5&CSS tutorial.

If you are a proficient programmer and know a bit of HTML but no JavaScript, you should expect to find the code pretty confusing at first, but hopefully it will make sense soon enough.  Here are some **important** things to grasp before going much further:
* [jQuery](http://en.wikipedia.org/wiki/JQuery)
* [callbacks and the asynchronous paradigm] (http://recurial.com/programming/understanding-callback-functions-in-javascript/)
* [closures](http://stackoverflow.com/questions/111102/how-do-javascript-closures-work)
* [TypedArrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays)
* [Workers](http://www.w3schools.com/html/html5_webworkers.asp)   
* WebGL. ([Nice diagram](https://www.ssugames.org/pluginfile.php/1401/mod_resource/content/1/08-alpha/index.html#slide-3))
* [WebComponents and Polymer](http://www.polymer-project.org/)
* FileSystem API
* JavaScript Blobs
* V8 optimization in Chrome     

You will also need to accept that although JavaScript is not as fast as  C/Java/Matlab/Python etc and in many ways is a horrible language, it is pretty easy to write a very interactive and responsive application using it.

In most browsers you can press F12 to gain access to the developer tools, which include a feature-rich debugger and interactive console, plus a way of examining the properties of elements on the page.  Note that because you have access to the command line you can easily write a simple script to modify the cut, or better still, you can add a new function to the code-base without bothering to create a proper interactive way of using it, but you will still be able to access it from the command line.


Oh, and if you've got this far and are still not sure whether JavaScript has anything to do with Java, let me teach you the number one JavaScript fact: JavaScript and Java having nothing in common (beyond the fact they are both programming languages that begin with the letters j-a-v-a).

#### A bit more detail about data structures
A good GUI is highly interactive and responsive, even when it is doing heavy processing or rendering, however achieving this in code can be pretty complicated.  

**Subscribing to Events**      
One of the pardigms we use here is we allow bits of code to "subscribe" to "events", meaning that whenever a particular kind of event occurs a list of functions will be called and passed the data relating to the event.  There is not a great deal of standardisation, but here is a (possibly incomplete) list of the "events" that can be "subscribed" to together with a few nuggets of information about the corresponding section of the application:   

##### `FileStatusCallback`     
Whenever we switch experiment, tetrode or cut, the `T.ORG` module loads only the minimal number of new files.  It uses `T.PAR` to load and parse the files (which is done with a worker on another thread). As the files become available the callbacks registered with `AddFileStatusCallback` are informed. These callbacks recieve a `status` object with one field for each of the filetypes (`pos`,`set`,`tet`, and `cut`) and a `filetype` string to say which file has just been loaded (or `null` if this is a "heads-up" occurring at the start of a load).  The four `status` fields store an integer with the following meanings:
  * 0 - file does not exist
  * 1 - file exists but has not been announced yet
  * 2 - this is the file currently being announced
  * 3 - file has already been announced

##### `CutChangeCallback` and `CutActionCallback`    
One of the main features of the GUI is its ability to modify cut groups.  Whenever a change is made both the `CutChangeCallback` and `CutActionCallback` "events" fire, there is supposed to be a slight difference between these two events (for more details see the comments at the top of `cut.js`). Modifying cuts should be a fluid process with no major delays or unresponsiveness. In order to achieve this, the `CUT` class keeps a list of immutable `cutInds` arrays.  Whenever one of these cutInds arrays needs to be modified, we create a new immutable and remove the old one.  Each immutable has a history of cut groups associated to it.  This makes it easy for the waveform rendering module (and other modules) to avoid doing unnecessary work.  A slight detail in the way the immutables are implemented is that they each occupy a "slot" in an array of slots.  When immutables are deleted and created, slots get reused (this prevents the array of immutables from growing too large).  Thus in order to distinguish between all the immutables that occupy a given slot over time, we have an extra property, which is the `generation` of the immutable in the slot. 

##### `canvasUpdatedListeners`    
This event fires whenever a new plot is produced for one of the groups.  It's a while since I've looked at this, but I think its only purpose is for telling the splitting tool when the new tile has been populated.  A more important thing to note is the way `T.CutSlotCanvasUpdate` operates as the "delivery" point for plots that are produced by the different modules (temporal autocorr, ratemap, waves).  The creation of these plots is triggered by the loading of the relevant files and by changes in the cut, i.e. it's not the case that some central part of the program requests a list of particular plots and then waits to have them produced.

##### `modeChangeCallbacks`    
This event fires when we toggle between normal and "drift" mode.  It hints at being a slightly more general event, but at the moment I think that is all it does.  Several of the plotting modules subscribe to this event so they can produce new plots whenever the mode changes.


**Rendering the waves**    
Rendering the waves is done on a hidden canvas using WebGL, the resulting images are then copied to small visible canvases on the page.  When the tetrode data is first loaded, it gets copied across to the GPU so that it can be used quickly during rendering.  Every effort is made to ensure that redundant rendering is avoided (making use of the immutable cut slot structure).  When we do need to render, a special vector is created that gives the x and y offset on the offscreen canvas for each wave, plus a colormap index for the wave.  We render a line from `t` to `t+1` for every single wave simultaneously, then increment `t` and render the next line (there are 50 points on the wave so 49 lines to be drawn per channel).  The rendering is done this way as it minimises the amount of data that needs to be written to the gpu for each render, it also makes for a very simple vertex shader.

**Some more info on T.Tool**   
There is a `T.Tool.STATE` key-value map which holds each of the tools and their corresponding state objects. While a particular tool is active, `T.Tool.cState` is set to to that tool's `STATE` object.  These state objects hold details like active group number and references to relevant dom nodes.


#### Autocut    
**[Under active development, info may not be up to date]**  
The implementation is only partially complete: it just uses the data from the currently viewed channel (i.e. you cannot cut on multiple channels); more importantly, it only produces clusters for a random sample of 1024*6 spikes.
Getting this far took quite a bit of effort, but finishing off the method should be relatively easy (though will likely still take a reasonable amount of time to code).
There are basically 5 stages, the first 3 of which have been implemented, though they require some generalisations:

1. Compute full distance matrix for about 6000 waveforms, taking the sum of absolute differences along the length of the waves. [This is runs fast here as it uses the GPU, Matlab is relatively quick on the CPU but does take a resonable amount of time.]

1. Build the hierarchy for the 6000 waveforms, for the distance metric use the average distance from waves in one group to waves in the other group.  To get the hierarchy, iteratively combine the two closest groups until there is only one group. [This is slow in javascript, but fast in Matlab's mex routine.]

1. Partition the 6000 waveforms into groups, using the hierarchy.  This is relatively simple, we just cut the hierarchy into sections so that no group has more than a certain number of leaves.  This does mean that some groups will have only a very small number of leaves (i.e. spikes) but it generally is a major problem.
<li>For the remaining waveforms, compute the distance matrix to the initial 6000 waves. [To do this efficiently need to sort the 6000 waves by group, and zero-pad them into blocks of 32.  Can then do partial sums on the GPU and thus transfer less data back to the CPU - the next step only needs to know the sums (or means) across groups, not the individual values in the distance matrix]

1. For all waveforms, find the mean distance to each of the groups and choose the nearest group as the group for that waveform. [Once the previous step has been completed this should be pretty simple.]</li>
