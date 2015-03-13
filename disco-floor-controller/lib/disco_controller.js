'use strict';

var fs = require('fs'),
		path = require('path'),
		events = require('events'),
		util = require('util'),
		discoUtils = require('./utils.js'),
		FloorCell = require('./floor_cell.js');

var eventEmitter = new events.EventEmitter(),
	controller,
	programs = [],
	program;

/**
	Setup a fresh disco controller

	@method refreshController
*/
function refreshController(){
	var x = 10,
			y = 10,
			dimensions;

	if (controller) {
		dimensions = controller.getDimensions();
		x = dimensions.x;
		y = dimensions.y;

		dimensions = null;
		controller = null;
	}

	controller = new DiscoController(x, y);
	module.exports.controller = controller;
	return controller;
}
module.exports.refreshController = refreshController;

/**
	Run a disco program

	@method runProgram
	@param {String} file The name of the program file to run
*/
module.exports.runProgram = function(file){
	var controller = refreshController();

	program = require('../programs/'+ file);
	program.init(controller).then(function(){
		program.run();
	});
};

/**
	Get a list of disco programs

	@method runProgram
	@param {String} file The name of the program file to run
	@return {Promise} which will resolve with the program list
*/
module.exports.getProgramList = function(){

	// Read files from the programs directory
	if (!programs || programs.length === 0) {
		return new Promise(function(resolve, reject) {
			programs = [];

			// Get program list
			fs.readdirSync('./programs/').forEach(function(file, i){
				try {
					programs[i] = require('../programs/'+ file);
					programs[i].file = file;
				} catch(e) {
					process.stderr.write(e.message);
					process.stderr.write(e.stack);
				}
			});

			// Sort by name
			programs = programs.sort(function(a, b){
				a = a.name.toLowerCase();
				b = b.name.toLowerCase();

				if (a < b) {
					return -1;
				} else if (a > b) {
					return 1;
				}
				return 0;
			});

			resolve(programs);
		});
	}

	// Return cached list
	return Promise.resolve(programs);
};

/**
	The fade loop is called many times a second to set the color
	of all the floor cells that are being faded

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
				this.loop();
			}.bind(this));
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
					this.loop();
				}.bind(this));
				// setTimeout(function(){
				// 	this.loop()
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

				colorDiff = to - from,
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
		Set floor dimensions

		Fires the following PubSub topics:
			* floor:dimensions:willChange: The floor dimensions are about to change
			* floor:dimensions:changed: The floor dimensions have changed

		@method setDimensions
		@param {int} x Floor width
		@param {int} y Floor height
	*/
	this.setDimensions = function(x, y) {
		if (typeof x != "number" || typeof y != "number" || x <= 0 || y <= 0) {
			throw "Dimensions need to be be greater than zero.";
		}

		eventEmitter.emit('dimensions.willChange', x, y);

		cells = [];
		dimensions.x = x;
		dimensions.y = y;

		// Create cells
		var i = 0;
		for (var yPos = 0; yPos < y; yPos++) {
			for (var xPos = 0; xPos < x; xPos++) {
				// console.log(i, xPos, 'x', yPos);
				cells[i++] = new FloorCell(xPos, yPos, this);
			}
		}

		eventEmitter.emit('dimensions.changed', x, y);
	}

	/**
		Get the floor dimensions

		@method getDimensions
		@return {Object} Object with the floor's x/y values
	*/
	this.getDimensions = function() {
		return dimensions;
	}

	/**
		Return all the cells for the entire floor

		@method getCells
		@returns {Array of FloorCell}
	*/
	this.getCells = function(){
		return cells;
	}

	/**
		Return the floor cell at this x/y location

		@method getCell
		@param {int} x The x position of the cell
		@param {int} y The y position of the cell
		@return FloorCell
	*/
	this.getCell = function(x, y) {
		var index, cell,
			xMax = dimensions.x;

		if (x < 0 || y < 0 || x >= dimensions.x || y >= dimensions.y) {
			throw util.format('Invalid x/y coordinate: %sx%s', x, y);
		}

		// Unwind the x/y coordinates into flat index
		index = (y * xMax) + x;
		cell = cells[index];

		// Validate index
		if (!cell || (cell && cell.getX() != x || cell.getY() != y)) {
			for (var i = 0; i < cells.length; i++) {
				if (cells[i].getX() == x && cells[i].getY() == y) {
					break;
				}
			}
			throw util.format('Cell at index %s doesn\'t match x/y coordinate expected: %sx%s', index, x, y);
		}
		return cell;
	}

	/**
		Start the fade loop which will animate any
		fading cell

		@method startFadeLoop
	*/
	this.startFadeLoop = function() {
		FadeLoop.start();
	}

	this.setDimensions(x, y);
};

// Init a new controller
controller = new DiscoController(6, 6);
module.exports.controller = controller;
