'use strict';

var fs = require('fs'),
    path = require('path'),
    events = require('events'),
    util = require('util'),
    discoUtils = require('./utils.js'),
    FloorCell = require('./floor_cell.js'),
    Promise = require("bluebird");

var eventEmitter = new events.EventEmitter(),
  controller;

/**
  Are we emulating the floor or actually communicating
  with a real one?

  @property emulatedFloor
  @type boolean
*/
module.exports.emulatedFloor = true;


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

    // Return the promise of the last cell
    return cells[i - 1].getFadePromise() || Promise.resolve();
  };

  this.setDimensions(x, y);
};

// Init a new controller
controller = new DiscoController(8, 8);
module.exports.controller = controller;
