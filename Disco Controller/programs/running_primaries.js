'use strict';

var Promise = require("bluebird");

var floorController = null,
		running = true,
		colors = [],
		fadeDuration = 3000,
		timeout;

module.exports = {

	info: {
		name: 'Running Primaries',
		description: "Fades in primary colors, chasing from one cell to the next",
		interactive: false,
		miniumumTime: 0.5
	},

	/**
		Setup the program
	*/
	init: function(controller){
		running = true;
		floorController = controller;
		return Promise.resolve();
	},

	/**
		Shutdown this program and clear memory
	*/
	shutdown: function(){
		running = false;
		clearTimeout(timeout);
		return floorController.changeAllCells([0,0,0], 2000);
	},

	/**
		Run the program
	*/
	run: function(){
		var cells = floorController.getCells(),
				colorSelect, color;

		if (!running) return;

		for (var i = 0, len = cells.length; i < len; i++) {
			colorSelect = colors[i];
			colorSelect = (colorSelect === undefined) ? i : ++colorSelect;
			if (colorSelect >= 3) {
				colorSelect = 0;
			}
			colors[i] = colorSelect;


			color = [0,0,0];
			color[colorSelect] = 255;
			cells[i].fadeToColor(color, fadeDuration);
		}

		timeout = setTimeout(this.run.bind(this), fadeDuration + 1500);
	}

};