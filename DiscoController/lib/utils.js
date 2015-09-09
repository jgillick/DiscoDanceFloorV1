'use strict';


/**
	Wraps a value to fit within the minimum and max values.

	```
	wrap(5, 0, 4); // 0
	wrap(5, 4);    // 0
	wrap(7, 0, 4); // 3
	wrap(1, 3, 5); // 3

	@method @wrap
	@param {int} value
	@param {int} (optional) min Minimum value, defaults to 0
	@param {int} max
*/
module.exports.wrap = function(value, min, max) {

	if (arguments.length === 2){
		max = min;
		min = 0;
	}

	// Wrap until we fit
	while(true) {
		if (value > max) {
			value = min + (value - (max + 1));
		}
		else if (value < min) {
			value = max + (value - (min - 1));
		}
		else {
			break;
		}
	}

	return value;
};

/**
	Convert a 3 - 6 character color HEX code to
	RGB interger values from 0 - 255

	@method hexToRGB
	@param {String} hex A 3 or 6 character hex code
	@return {Array} Array of integers from 0 - 255
*/
module.exports.hexToRGB = function(hex) {
	var rgb = null;

	// Break up colors
	switch (hex.length) {
		case 3:
			rgb = /^([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
			break;
		case 6:
			rgb = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
			break;
	}

	if (!rgb) {
		throw "Invalid HEX color code: "+ hex;
	}

	// Convert to integer
	rgb.shift();
	for (var i = 0; i < 3; i++) {
		// Fix 3 character hex codes
		if (hex.length == 3) {
			rgb[i] += rgb[i];
		}

		rgb[i] = parseInt(rgb[i], 16);
	}

	return rgb.slice(0,3);
};


/**
	Convert 3 values into an RGB HEX code

	@method rgbToHex
	@param {String} red The value for red (0 - 255)
	@param {String} green The value for green (0 - 255)
	@param {String} blue The value for blue (0 - 255)

	@return {String} A 6 character HEX code
*/
module.exports.rgbToHex = function(red, green, blue) {
	var color = [red, green, blue],
		fullHex = "", hex;

	for (var i = 0; i < 3; i++) {
		hex = color[i].toString(16);

		if (hex.length == 1) { // padding
			hex = '0'+ hex;
		}
		fullHex += hex;
	}

	return fullHex;
};


