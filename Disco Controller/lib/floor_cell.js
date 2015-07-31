/**
	Floor cell object
	@private

	@class FloorCell
	@param {int} xPos The x coordinate position of this cell on the floor
	@param {int} yPos The y coordinate position of this cell on the floor
	@param {FloorController} discoController The floor controller this cell belongs to
*/

'use strict';

var Promise = require("bluebird"),
		events = require('events'),
		disco 		 = require('./disco_controller.js'),
		discoUtils = require('./utils.js');


function FloorCell (xPos, yPos, discoController) {

	this.MODE_NORMAL = 0;
	this.MODE_FADING = 1;

	var x = xPos,
		y = yPos,
		controller = discoController,
		mode = 0,
		value = 0,
		color = [0,0,0],
		fadeColor = [0,0,0],
		fadeDuration = 0,
		fadePromise = null;

	/**
		Events emitted are:

		* colorChanged: The color of this cell has changed
		* fadeStart: A color fade has being
		* fadeEnd: The fade has completed
		* valueChanged: The cells step value has changed

		@property events
		@type EventEmitter
	*/
	this.events = new events.EventEmitter();

	/**
		Set the cells x/y position on the floor

		@method setXY
		@params {int} xPos
		@params {int} yPos
	*/
	this.setXY = function(xPos, yPos) {
		x = xPos;
		y = yPos;
	};

	/**
		Get the current mode of this cell.
		Either:
		* `FloorCell.MODE_NORMAL`
		* `FloorCell.MODE_FADING`

		@method getMode
		@return int
	*/
	this.getMode = function() {
		return mode;
	};

	/**
		True if the floor is currently fading

		@method isFading
		@return boolean
	*/
	this.isFading = function() {
		return mode == FloorCell.MODE_FADING;
	};

	/**
		Get the x position of this cell

		@method getX
		@return int
	*/
	this.getX = function() {
		return x;
	};

	/**
		Get the y position of this cell

		@method getY
		@return int
	*/
	this.getY = function() {
		return y;
	};

	/**
		Set the color of this cell

		@method setColor
		@param {Array or String} rgb Color defined as an RGB array or HEX string
		@param {boolean} stopFade (optional) If currently faing, set this to `false` to not stop the current fade.
								  Otherwise, the fade will continue from this color
								  Deaults to 'true'
	*/
	this.setColor = function(rgb, stopFade) {
		if (typeof rgb == 'string') {
			rgb = discoUtils.hexToRGB(rgb);
		}

		// Stop the current fade
		if (stopFade !== false && mode == FloorCell.MODE_FADING) {
			fadeColor = rgb;
			return this.stopFade();
		}

		color = rgb;
		this.events.emit('colorChanged', color);
		controller.events.emit('cell.colorChanged', x, y, color);
	};

	/**
		Get the current color of the cell

		@method getColor
		@return {Array} RGB color array
	*/
	this.getColor = function() {
		return color.slice(0);
	};

	/**
		Set the cell to fade to a color

		@method fadeToColor
		@param {Array or String} color The color to fade to. Either an RGB array or string HEX code
		@param {int} duration The time, in milliseconds, it should take to fade to the color

		@return {Promise} which will resolve when the fade is complete
	*/
	this.fadeToColor = function(color, duration) {
		if (typeof color == 'string') {
			color = discoUtils.hexToRGB(color);
		}

		fadeColor = color;
		mode = FloorCell.MODE_FADING;
		fadeDuration = duration;

		this.events.emit('fadeStart', color, duration);
		controller.events.emit('cell.fadeStart', x, y, color, duration);

		fadePromise = Promise.pending();
		return fadePromise.promise;
	};

	/**
		Get the color we're fading to

		@method getFadeColor
		@return {Array} RGB color array
	*/
	this.getFadeColor = function(){
		return fadeColor.slice(0);
	};

	/**
		Get the duration of the current fade

		@method getFadeDuration
		@return int
	*/
	this.getFadeDuration = function(){
		return fadeDuration;
	};

	/**
		Set a new duration for the current fade

		@method setFadeDuration
		@param {int} duration The new fade duration from this moment until the end of th fade
	*/
	this.setFadeDuration = function(duration) {
		fadeDuration = duration;
	};

	/**
		Stop the current fade

		@method stopFade
	*/
	this.stopFade = function() {
		this.setColor(fadeColor, false);
		fadeDuration = 0;

		if (fadePromise) {
			fadePromise.resolve();
		}

		this.events.emit('fadeEnd');
		controller.events.emit('cell.fadeEnd', x, y);
	};

	/**
		Return the promise object for the current fade operation

		@method getFadePromise
		@returns Promise
	*/
	this.getFadePromise = function() {
		if (mode == FloorCell.MODE_NORMAL) {
			return fadePromise.promise;
		}
		return null;
	};

	/**
		Set the binary step value of the floor cell:
		* 0: Not stepped on
		* 1: Stepped on

		@method setValue
		@param {val} int The step value
	*/
	this.setValue = function(val){
		if (val != value) {
			value = val;
			this.events.emit('valueChanged', val);
			controller.events.emit('cell.valueChanged', x, y, val);
		}
	};

	/**
		Get the step value of the floor cell

		@method getValue
		@return {int} 0: not stepped on, 1: stepped on
	*/
	this.getValue = function(){
		return value;
	};

}

module.exports = FloorCell;
