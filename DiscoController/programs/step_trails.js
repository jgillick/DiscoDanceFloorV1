'use strict';

var Promise = require("bluebird");

var controller,
		colorTimer,
		color = [0, 0, 255],
		colorTime = 10000;

module.exports = {

	info: {
			name: 'Step Trails',
			description: 'Lights up each step and slowly fades out when stepped off.',
			interactive: true,
			miniumumTime: 1
	},

	/**
		Setup the program
	*/
	init: function(floorController){
		controller = floorController;
		colorTimer = null;
		color = [0, 0, 255];
		return Promise.resolve();
	},

	/**
		Shutdown this program and clear memory
	*/
	shutdown: function(){
		clearInterval(colorTimer);
		colorTimer = null;
		return controller.changeAllCells([0,0,0], 2000);
	},

	/**
		Run the program
	*/
	run: function(){
		controller.events.on('cell.valueChanged', function(x, y, value){

			// Start phase timer, if it hasn't started already
			if (colorTimer === null) {
				colorTimer = setInterval(changeColor, colorTime);
			}

			// On or Off
			if (value > 0) {
				stepOn(x, y);
			} else {
				stepOff(x, y);
			}
		}.bind(this));
	}
};

/**
	Select another color
*/
function changeColor(){
	var min = 150,
			max = 255,
			rgbSelect = -1,
			lastSelect = -1;

	color = [0,0,0];

	// Set 2 of the 3 colors
	for (var c = 0; c < 2; c++) {
		// Which RGB color to set
		while(lastSelect === rgbSelect) {
			rgbSelect = Math.floor(Math.random() * 3);
		}

		// The second color can only be 0 - 125
		if (c == 1) {
			min = 0;
		}
		color[rgbSelect] = Math.floor(Math.random() * (max - min) + min);
		lastSelect = rgbSelect;
	}

	console.log('New color:', color);
}

/**
	Handle a cell that has been stepped on

	@param {int} x The x coordinate of the cell
	@param {int} y The y coordinate of the cell
*/
function stepOn(x, y) {
	var cell = controller.getCell(x, y);
	cell.fadeToColor(color, 800);
	// cell.setColor(color);
}

/**
	Handle a cell that has been stepped off
	@param {int} x The x coordinate of the cell
	@param {int} y The y coordinate of the cell
*/
function stepOff(x, y) {
	var cell = controller.getCell(x, y);
	cell.fadeToColor([0,0,0], 2000);
	// cell.setColor([0,0,0]);
}