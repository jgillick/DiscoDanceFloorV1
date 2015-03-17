'use strict';

var disco = require('./lib/disco_controller.js'),
		utils = require('./lib/utils.js');

(function() {
	var fadeProcessing = false;

	$(document).ready(function(){
		var dimensions = disco.controller.getDimensions();

		// Set floor dimensions
		$('#floor-max-x').val(dimensions.x);
		$('#floor-max-y').val(dimensions.y);

		// User updated floor dimensions
		$('.dimensions input').keyup(function(){
			var x = parseInt($('#floor-max-x').val() ),
				y = parseInt($('#floor-max-y').val() );

			if (x != NaN && y != NaN) {
				disco.controller.setDimensions(x, y);
			}
		});

		// Step on/off floor cells
		$('table.grid').mousedown(function(evt){
			if (evt.target.nodeName != "TD") return;

			var td = $(evt.target);
				x = parseInt(td.attr('data-x')),
				y = parseInt(td.attr('data-y')),
				cell = disco.controller.getCell(x, y);

			cell.setValue(1);
		});
		$('table.grid').mouseup(function(evt){
			if (evt.target.nodeName != "TD") return;

			var td = $(evt.target),
				x = parseInt(td.attr('data-x')),
				y = parseInt(td.attr('data-y')),
				cell = disco.controller.getCell(x, y);

			cell.setValue(0);
		});


		buildFloor(dimensions['x'], dimensions['y']);
	});
	window.onresize = sizeTable;

	/**
		Build floor grid
	*/
	function buildFloor(xMax, yMax) {
		var emulator = $('.emulator'),
			table = emulator.find('table.grid'),
			tbody = document.createElement('tbody'),
			styles = [],
			tr, td, cell;

		table.empty();

		// Create rows and cells
		for (var y = 0; y < yMax; y++) {
			tr = document.createElement('tr');
			for (var x = 0; x < xMax; x++) {
				td = document.createElement('td');
				td.id = "cell-"+ x +"-"+ y;
				td.setAttribute('data-x', x);
				td.setAttribute('data-y', y);
				tr.appendChild(td);
			}
			tbody.appendChild(tr);
		}

		table.append(tbody);
		process.nextTick(sizeTable);
	}

	/**
		Size the table to keep the floor cells square in the available space
	*/
	function sizeTable() {
		var emulator = $('.emulator'),
				table = emulator.find('.grid'),
				dimensions = disco.controller.getDimensions(),
				xMax = dimensions.x,
				yMax = dimensions.y,
				styles = [],
				height, width, cellWidth, cellHeight;

		table.css({
			'height': '100%',
			'width': '100%',
		});

		if (xMax < yMax) {
			table.css('width', table.outerHeight()/yMax);
		}
		else if (xMax > yMax) {
			table.css('height', table.outerWidth()/xMax);
		}

		// height = emulator.height();
		// width = emulator.width();

		// // Determine the cell height to keep each cell square
		// cellWidth = width / dimensions.x;
		// cellHeight = height / dimensions.y;
		// if (cellWidth < cellHeight) {
		// 	cellHeight = cellWidth;
		// } else {
		// 	cellWidth = cellHeight;
		// }

		// // Set styles
		// $('#grid-dimensions').html('table.grid td { width: '+ cellWidth +'px; height: '+ cellHeight +'px }');
	}


	/**
		Converts an RGB color value to HSL. Conversion formula
		adapted from http://en.wikipedia.org/wiki/HSL_color_space.
		Assumes r, g, and b are contained in the set [0, 255] and
		returns h, s, and l in the set [0, 1].

		SOURCE: http://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion

		@param {Array} rgb RGB color values array
		@return {Array} The HSL representation
	 */
	function rgbToHsl(rgb){
	    var r = rgb[0] / 255,
	        g = rgb[1] / 255,
	        b = rgb[2] / 255;

	    var max = Math.max(r, g, b), min = Math.min(r, g, b);
		var h, s, l = (max + min) / 2;

		if(max == min){
		  h = s = 0; // achromatic
		} else {
		  var d = max - min;
		  s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		  switch(max){
		      case r: h = (g - b) / d ; break;
		      case g: h = 2 + ( (b - r) / d); break;
		      case b: h = 4 + ( (r - g) / d); break;
		  }
		  h*=60;
		  if (h < 0) {
		      h +=360;
		  }
		}

	    return [h, s, l];
	}

	/**
		Get rid of dark colors.
		The floor has a white filter on it, so when the LEDs
		are off (i.e. #000000), the floor will be off-white, not black.

		To do this, convert RGB to HSL and use the lightness value to determine the opacity of
		the color.

		@param {String or Array} color A HEX string or array of RGB integer values
		@return {Array} Array of normalized RGB values
	*/
	function normalizeColors(color) {
		var hsla = rgbToHsl(color);

	  // Adjust opacity based on lightness
	  // Anything below 60% should become more transparent because the
	  // floor tiles are white
	  hsla[3] = 1;
	  if (hsla[2] < 0.6) {
	    hsla[3] = (hsla[2] / 0.6) + 0.05;
	  }

	  // Convert to percent
	  hsla[1] = Math.round(hsla[1] * 100) +'%';
	  hsla[2] = Math.round(hsla[2] * 100) +'%';

	  return hsla;
	}

	/**
		Update the floor as a one frame
	*/
	function updateFrame(){
		var dimensions = disco.controller.getDimensions(),
			styleEl = document.getElementById('grid-frame'),
			styles = [],
			cells = disco.controller.getCells(),
			color, cell;

		for (var i = 0, len = cells.length; i < len; i++) {
			cell = cells[i];
			color = normalizeColors(cell.getColor());
			styles[i] = '#cell-'+ cell.getX() +'-'+ cell.getY() +' { background-color: hsla('+ color.join(',') +') !important; }';
		}

		// Add styles
		if (styleEl) {
			styleEl.innerHTML = styles.join('\n');
		}
		//window.requestAnimationFrame(updateFrame);)
	}

	// Update floor grid
	disco.controller.events.on('dimensions.changed', function(xMax, yMax){
		buildFloor(xMax, yMax);
	});

	// Start stop fade processing
	disco.controller.events.on('fadeFrame.start', function(){
		fadeProcessing = true;
	});
	disco.controller.events.on('fadeFrame.end', function(){
		fadeProcessing = false;
		// window.requestAnimationFrame(updateFrame);
	});

	// Update single floor cell
	disco.controller.events.on('cell.colorChanged', function emulatorSetColor(x, y, color){
		var el = document.getElementById('cell-'+ x +'-'+ y);

		if (!el) {
			return;
		}

		// Get rid of dark colors (because the floor is white)
		color = normalizeColors(color);

		// Set color
		el.style.background = 'hsla('+ color.join(',') +')';
	});
})();
