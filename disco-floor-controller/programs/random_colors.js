'use strict';

var Promise = require("bluebird");

var floorController = null;

module.exports = {

	name: 'Random Colors',
	description: "Fades random colors across the floor.",

	/**
		Setup the program
	*/
	init: function(controller){
		floorController = controller;
		return Promise.resolve();
	},

	/**
		Shutdown this program and clear memory
	*/
	shutdown: function(){
		floorController = null;

		// Stop fade rotation
		this.fadeToColor = function(){};

		return Promise.resolve();
	},

	/**
		Run the program
	*/
	run: function(){
		var cells = floorController.getCells();
		for (var i = 0, len = cells.length; i < len; i++) {
			this.fadeToColor(cells[i]);
		}
	},

	/**
		Generate a random color
	*/
	generateColor: function(){
		var color, total;

		// If the sum of all three colors is less than 200, it will be too
		// light to see
		// do {
		// 	color = [ Math.floor(Math.random() * 128) + 127,
		// 			  Math.floor(Math.random() * 128) + 127,
		// 			  Math.floor(Math.random() * 128) + 127 ];

		// 	total = color.reduce(function(a, b) { return a + b});
		// } while(total < 200)

		color = [ Math.round(Math.random() * 256),
				  Math.round(Math.random() * 256),
				  Math.round(Math.random() * 256)
				];

		return color;
	},

	/**
		Have a cell fade to a random color
	*/
	fadeToColor: function(cell) {
		var time = Math.random(Math.random() * 1000) + 1000,
			 color = this.generateColor();

		// Set fade to and from
		cell.fadeToColor(color, time)
			.then(function(){
				this.fadeToColor(cell);
			}.bind(this));
	}

};