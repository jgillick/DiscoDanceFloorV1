'use strict';

var fs = require('fs'),
    path = require('path'),
    events = require('events'),
    util = require('util'),
    discoUtils = require('./utils.js'),
    FloorCell = require('./floor_cell.js'),
    Promise = require("bluebird");

var eventEmitter = new events.EventEmitter(),
  controller,
  programs = [],
  playerTimout,
  program;

/**
  Are we emulating the floor or actually communicating
  with a real one?

  @property emulatedFloor
  @type boolean
*/
module.exports.emulatedFloor = true;

/**
  Set to true to play all the programs, one at a time
*/
module.exports.playAll = false;

/**
  Filter the programs that will be payed when selecting Play All
  Possible values are:
    * `interactive: true`,
    * `audio: true`
*/
module.exports.playAllFilters = {};

/**
  Run all programs. You can filter out programs by passing in
  and object with either `audio: true` and/or `interactive: true`.

  @method runAll
  @param {Object} filters (optional) An object used to filter out programs
*/
module.exports.runAllPrograms = function(filter) {
  this.playAllFilters = filter;
  this.playAll = true;
  this.runProgram('');
};

/**
  Run a disco program from the 'programs' directory

  @method runProgram
  @param {String} name The name of the program file to run
  @return Promise
*/
var runProgram = function(name){
  var shutdown, timeout,
      self = this,
      promiseResolver = Promise.pending();

  // Play all programs
  if (name === '' && this.playAll) {
    getProgramList(this.playAllFilters)
    .then(function(programs){
      var autoRunIndex = 0;

      function autoRun() {
        var prog = programs[autoRunIndex],
            time = prog.info.miniumumTime || 0.5;

        self.runProgram(prog.file);

        autoRunIndex++;
        if (autoRunIndex > programs.length - 1) {
          autoRunIndex = 0;
        }

        // Play for `minimumTime` minutes
        time *= 60000;
        playerTimout = setTimeout(autoRun, time);
      }
      autoRun();
    });
    return;
  }
  else if (!self.playAll) {
    clearInterval(playerTimout);
  }

  if (!name.match(/\.js$/)) {
    name = name +'.js';
  }

  function start() {
    try{
      program = require('../programs/'+ name);
      program.file = name;
      program.init(controller).then(function(){
        promiseResolver.resolve();
        program.run();
        eventEmitter.emit('program.started', name);
      });
    } catch(e) {
      console.log(e.message);
      promiseResolver.reject(e.message);
      eventEmitter.emit('program.error', e);
    }
  }

  // Shutdown the last program before starting the new one
  if (program) eventEmitter.emit('program.shutting-down', program.file);
  shutdown = (program) ? program.shutdown() : Promise.resolve();
  shutdown.then(function(){
    if (program) eventEmitter.emit('program.shutdown', program.file);
    clearTimeout(timeout);
    start();
  });

  // Failsafe timeout, in case shutdown function does not complete in 4 seconds
  timeout = setTimeout(start, 4000);

  return promiseResolver.promise;
};
module.exports.runProgram = runProgram;

/**
  Get a list of available disco programs.

  @method getProgramList
  @param {Object} filter Use an object to filter programs out
  @return {Promise} which will resolve with the program list
*/
var getProgramList = function(filter){
  filter = filter || {};

  function filterPrograms(program) {
    return (filter.interactive === undefined || program.info.interactive === filter.interactive) &&
            (filter.audio === undefined || program.info.audio === filter.audio);
  }

  // Read files from the programs directory
  if (!programs || programs.length === 0) {
    return new Promise(function(resolve) {
      programs = [];

      // Get program list
      fs.readdirSync('./programs/').forEach(function(file){
        try {
          var prog = require('../programs/'+ file);
          prog.file = file;
          programs.push(prog);
        } catch(e) {
          process.stderr.write(e.message);
          process.stderr.write(e.stack);
        }
      });

      // Sort by name
      programs = programs.sort(function(a, b){
        a = a.info.name.toLowerCase();
        b = b.info.name.toLowerCase();

        if (a < b) {
          return -1;
        } else if (a > b) {
          return 1;
        }
        return 0;
      });

      resolve(programs.filter(filterPrograms));
    });
  }

  // Return cached list
  return Promise.resolve(programs.filter(filterPrograms));
};
module.exports.getProgramList = getProgramList;

/**
  The fade loop handles every step of fading one color to another
  and is called several times a second.

  @class FadeLoop
  @private
*/
var FadeLoop = {

  /**
    True if some cells are currently fading
  */
  fading: false,

  /**
    Number of milliseconds per loop
  */
  interval: 10,

  /**
    The time fo the last fade loop step
  */
  last_loop_time: 0,

  /**
    Start a fading loop, if one hasn't started already
    @method start
  */
  start: function(){
    if (!this.fading) {
      this.fading = true;
      this.last_loop_time = Date.now();
      window.requestAnimationFrame(function(){
      // setTimeout(function(){
        this.loop();
      }.bind(this));
      // }.bind(this), 30);
    }
  },

  /**
    Adjust the color of all the fading cells to the color they should be
    @method loop
  */
  loop: function() {
    var cell,
      fading = false,
      now = Date.now(),
      cells = controller.getCells(),
      sinceLastLoop = now - this.last_loop_time;

    eventEmitter.emit('fadeFrame.start');

    try {

      // Process all fading cells
      for (var i = 0, len = cells.length; i < len; i++) {
        cell = cells[i];
        if (cell.getMode() == FloorCell.MODE_FADING) {
          fading = true;
          this.setCellColor(cell, sinceLastLoop);
        }
      }

      // Continue to next loop, if we're still fading
      this.fading = fading;
      this.last_loop_time = Date.now();
      if (fading) {
        window.requestAnimationFrame(function(){
        // setTimeout(function(){
          this.loop();
        }.bind(this));
        // }.bind(this), 30);
        // setTimeout(function(){
        //  this.loop()
        // }.bind(this), 60);
      }

    } catch(e) {
      process.stderr.write(e.message);
      process.stderr.write(e.stack);
    }

    eventEmitter.emit('fadeFrame.end');
  },

  /**
    Set the color for this cell at this stage in the fade

    @method setCellColor
    @param {FadeCell} cell The cell to fade the color on
    @param {int} sinceLastLoop The number of milliseconds since the last fade loop processed
  */
  setCellColor: function(cell, sinceLastLoop){
    var fromRGB = cell.getColor(),
      toRGB = cell.getFadeColor(),
      duration = cell.getFadeDuration(),
      setRGB = [],
      fadeComplete = false,
      multiplier, colorDiff, increment;

    // Figure out how much to adjust each color by how much time has passed
    multiplier = sinceLastLoop / duration;

    // We must be done, skip ahead
    if (multiplier >= 1) {
      setRGB = toRGB;
      fadeComplete = true;
    }
    // Increment each color
    else {
      for (var i = 0; i < 3; i++) {
        var from = fromRGB[i],
          to = toRGB[i];

        colorDiff = to - from;
        increment = Math.round(colorDiff * multiplier);
        setRGB[i] = from + increment;
      }
    }

    // Set color
    cell.setColor(setRGB, fadeComplete);
    if (!fadeComplete) {
      cell.setFadeDuration(duration - sinceLastLoop);
    }
  }
};


/**
  The central controller for the disco floor.
  @class DiscoController
*/
var DiscoController = function(x, y){

  /**
    Floor max x/y dimensions
    @property dimentions
    @type Object
    @private
  */
  var dimensions = {x: 0, y: 0};

  /**
    All the cells of the floor
    @property cells
    @type Array of FloorCells
    @private
  */
  var cells = [];

  /**
    Map of cell addresses to their index in the `cells` array.

    @property cellAddresses
    @type Hash of addresses address to index numbers
    @private
  */
  var cellAddresses = {};

  /**
    Events emitted from the floor controller:

    * read: The floor is setup and ready
    * dimensions.willChange: The floor dimensions are about to change
    * dimensions.changed: The floor dimensions have just changed
    * cell.colorSet: A color has been set on a floor cell

    @property events
    @type EventEmitter
  */
  this.events = eventEmitter;

  /**
    Returns the index of the cell at the
    x/y position of the floor

    @private
    @method getCellIndex
    @param {int} x
    @param {int} y
    @returns int
  */
  function getCellIndex(x, y) {
    var index, cell,
      xMax = dimensions.x;

    if (x < 0 || y < 0 || x >= xMax || y >= dimensions.y) {
      throw util.format('Invalid x/y coordinate: %sx%s', x, y);
    }

    // Unwind the x/y coordinates into flat index
    index = (y * xMax) + x;
    cell = cells[index];

    // Validate index or search for it manually
    if (!cell || (cell && cell.getX() != x || cell.getY() != y)) {
      throw util.format('Internal Error: Cell at index %s doesn\'t match x/y coordinate expected: %sx%s', index, x, y);
    }

    return index;
  }

  /**
    Set floor dimensions

    Fires the following PubSub topics:
      * floor:dimensions:willChange: The floor dimensions are about to change
      * floor:dimensions:changed: The floor dimensions have changed

    @method setDimensions
    @param {int} x Floor width
    @param {int} y Floor height
  */
  this.setDimensions = function(x, y) {
    var i = 0;

    if (typeof x != "number" || typeof y != "number") {
      throw "Dimensions need to be be greater than zero.";
    }

    eventEmitter.emit('dimensions.willChange', x, y);

    dimensions.x = x;
    dimensions.y = y;

    // Create cells
    for (var yPos = 0; yPos < y; yPos++) {
      for (var xPos = 0; xPos < x; xPos++) {
        var cell = cells[i];
        if (cell){
          cell.setXY(xPos, yPos);
        } else {
          cells[i] = new FloorCell(xPos, yPos, this);
        }
        i++;
      }
    }

    // Remove unused nodes
    if (cells[i]) {
      cells = cells.slice(0, i);
    }

    eventEmitter.emit('dimensions.changed', x, y);
  };

  /**
    Automatically set the dimensions of the table to
    the most equal square possible, with the height
    being favored to be longer.

    For example:
      * If you have 100 nodes, the dimensions will be 10x10
      * If you have 110 nodes, the dimensions will be 10x11

    @method autoSetDimensions
    @returns Object with new x/y values
  */
  this.autoSetDimensions = function() {
    // No cells
    if (cells.length === 0) {
      this.setDimensions(0, 0);
      return dimensions;
    }

    var sqrt = Math.sqrt(cells.length),
        x = Math.floor(sqrt),
        y = Math.ceil(sqrt),
        diff = cells.length - (y * x);

    // Add extra rows for a not equal square
    if (diff > 0) {
      y += Math.ceil(diff / x);
    }

    this.setDimensions(x, y);
    return dimensions;
  };

  /**
    Get the floor dimensions

    @method getDimensions
    @return {Object} Object with the floor's x/y values
  */
  this.getDimensions = function() {
    return dimensions;
  };

  /**
    Create a new addressed floor cell and add it to
    the end of the list of cells.

    NOTE: This will also automatically reset the
    dimensions of the floor to new computed values.

    @method addCellWithAddress
    @param {byte} address The address for this cell
    @return FloorCell
  */
  this.addCellWithAddress = function(address) {
    var index = cells.length;

    cellAddresses[address] = index;
    cells.push(null); // setting dimensions will add the node
    this.autoSetDimensions();

    return cells[index];
  };

  /**
    Set an address on an existing floor cell.

    @method setCellAddress
    @param {int} x The x position of the cell
    @param {int} y The y position of the cell
    @param {byte} address The address for this cell
    @return FloorCell
  */
  this.setCellAddress = function(x, y, address){
    var index = getCellIndex(x, y);
    cellAddresses[address] = index;
    return cells[index];
  };

  /**
    Return all the cells for the entire floor

    @method getCells
    @returns {Array of FloorCell}
  */
  this.getCells = function(){
    return cells;
  };

  /**
    Return the floor cell at this x/y location

    @method getCell
    @param {int} x The x position of the cell
    @param {int} y The y position of the cell
    @return FloorCell
  */
  this.getCell = function(x, y) {
    return cells[getCellIndex(x, y)];
  };

  /**
    Get a cell by it's defined address

    @method getCellByAddress
    @params {byte} address The cell address
    @return FloorCell or null
  */
  this.getCellByAddress = function(address) {
    var index = cellAddresses[address];
    return cells[index] || null;
  };

  /**
    Make a global change to all floor cells

    @method changeAllCells
    @params {Array of bytes} color The RGB color
    @params {int} fadeDuration (optional) If set, the fade duration to get to that color
    @return Promise
  */
  this.changeAllCells = function(color, fadeDuration) {
    var i = 0;
    for (var len = cells.length; i < len; i++) {
      if (fadeDuration) {
        cells[i].fadeToColor(color, fadeDuration);
      } else {
        cells[i].setColor(color);
      }
    }

    return cells[i - 1].getFadePromise() || Promise.resolve();
  };

  /**
    Start the fade loop which will animate any
    fading cell

    @method startFadeLoop
  */
  this.startFadeLoop = function() {
    FadeLoop.start();
  };

  this.setDimensions(x, y);
};

// Init a new controller
controller = new DiscoController(8, 8);
module.exports.controller = controller;
