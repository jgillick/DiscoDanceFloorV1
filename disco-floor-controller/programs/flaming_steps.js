'use strict';

var Promise = require("bluebird");

var burning = [],
	controller;

module.exports = {

	name: 'Flaming Steps',
	description: "Make the cells burn when steped on and fade out when stepped off.",

	/**
		Setup the program
	*/
	init: function(floorController){
		controller = floorController;
		return Promise.resolve();
	},

	/**
		Shutdown this program and clear memory
	*/
	shutdown: function(){
		return controller.changeAllCells([0,0,0], 2000);
	},

	/**
		Run the program
	*/
	run: function(){
		controller.events.on('cell.valueChanged', function(x, y, value){
			if (value > 0) {
				this.flameOn(x, y);
			} else {
				this.flameOff(x, y);
			}
		}.bind(this));
	},

	/**
		Start burning the cell with firey color
	*/
	flameOn: function(x, y, step) {
		var cell = controller.getCell(x, y);

		// cell.fadeToColor('FDF103', 2000)
		// .then(function(){
		// 	return cell.fadeToColor('F3840B', 2000)
		// }.bind(this))
		// .then(function(){
		// 	return cell.fadeToColor('C3090A', 2000)
		// }.bind(this));
		cell.fadeToColor([255, 0, 0], 1000);
	},

	/**
		Let the fire on a cell start to die
	*/
	flameOff: function(x, y) {
		var cell = controller.getCell(x, y);
		cell.fadeToColor([0,0,0], 1000);
	}

};