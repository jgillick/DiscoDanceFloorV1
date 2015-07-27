'use strict';

var Promise    = require("bluebird"),
    discoUtils = require('../lib/utils.js'),
    audio      = require('../javascript/audio.js');

var floorController,
    running = false,
    blocks = [],
    mode = 'one',
    modeTimer,
    modeTimeout = 6000;

module.exports = {

  info: {
    name: 'Audio Blocks',
    description: 'Visualized audio in 4 blocks on the floor',
    interactive: false,
    audio: true,
    miniumumTime: 2
  },

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
    running = false;
    clearInterval(modeTimer);
    for (var i = 1; i < blocks.length; i++) {
      blocks[i].stop();
    }
    return floorController.changeAllCells([0,0,0], 300);
  },

  /**
    Run the program
  */
  run: function(){
    var dimensions = floorController.getDimensions(),
        x1, x2, y1, y2;

    // Create one for the entire floor
    blocks.push(new AudioBox(0, 6, [0,0], [dimensions.x - 1, dimensions.y - 1]));

    // And then four quadrants
    if (dimensions.x >= 8 && dimensions.y >= 8) {
      x1 = Math.ceil(dimensions.x/2) - 1;
      x2 = dimensions.x - 1;
      y1 = Math.ceil(dimensions.y/2) - 1;
      y2 = dimensions.y - 1;

      // Top left
      blocks.push(new AudioBox(0, 2, [0,0],
                                  [x1, y1]));
      // Top right
      blocks.push(new AudioBox(1, 4, [x1 + 1, 0],
                                  [x2, y1]));
      // Bottom left
      blocks.push(new AudioBox(2, 8, [0, y1 + 1],
                                  [x1, y2]));
      // Bottom right
      blocks.push(new AudioBox(3, 10, [x1 + 1, y1 + 1],
                                  [x2, y2]));

      modeTimer = setInterval(function() {
        mode = (mode == 'all') ? 'one' : 'all';
      }, modeTimeout);
    }

    // Setup audio
    audio.analyser.fftSize = 32;
    running = true;
    processAudio();
  }
};

/**
  Process new audio data
*/
function processAudio() {
  var data = new Uint8Array(audio.analyser.frequencyBinCount);

  if (!running) {
    return;
  }

  audio.analyser.getByteFrequencyData(data);

  if (mode == 'all') {
    for (var i = 0; i < blocks.length; i++) {
      blocks[i].update(data);
    }
  } else {
    blocks[0].update(data);
  }

  window.requestAnimationFrame(processAudio);
}

/**
  Handles the visuals for a single box
*/
function AudioBox(index, band, from, to) {
  var floorMap = [],
      primaryColor = discoUtils.wrap(index, 0, 2),
      colors = [],
      timer;

  function mapSection() {
    var xMin = from[0],
        yMin = from[1],
        xMax = to[0],
        yMax = to[1],
        xLen = xMax - xMin,
        yLen = yMax - yMin,
        ringNum = 0;

    // Figure out how many rings there are
    ringNum = (xLen > yLen) ? yLen : xLen;
    ringNum = Math.ceil(ringNum / 2);

    // Map all rings
    for (var i = 0; i < ringNum; i++) {
      floorMap[i] = [];

      for(var x = xMin + i; x <= xMax - i; x++) {
        floorMap[i].push([x, yMin + i]);
        floorMap[i].push([x, yMax - i]);
      }
      for(var y = yMin + i; y <= yMax - i; y++) {
        floorMap[i].push([xMin + i, y]);
        floorMap[i].push([xMax - i, y]);
      }
    }
  }

  function pickColors() {
    colors = [0,0,0];
    primaryColor = discoUtils.wrap(primaryColor+1, 0, 2);
    colors[primaryColor] = 255;

    // Random secondary color
    colors[Math.floor(Math.random() * 2)] = Math.round(Math.random() * 255);
  }

  /**
    Update the box with new audio data
  */
  this.update = function(data) {
    var bandData = data[band],
        scale = floorMap.length / 255,
        height = Math.round(bandData * scale);

    for (var i = 0; i < floorMap.length; i++) {
      var ring = floorMap[i],
          ringColor = colors.slice(0),
          intensity = bandData / 255;

      // Set the color as a percentage of the audio value
      for (var c = 0; c < 3; c++) {
        ringColor[c] = Math.round(ringColor[c] * intensity);
      }
      if (i >= height) {
        ringColor = [0,0,0];
      }

      // Fill in the rings
      for (var n = 0; n < ring.length; n++) {
        var cell = floorController.getCell(ring[n][0], ring[n][1]);
        cell.fadeToColor(ringColor, 100);
      }
    }
  };

  /**
    Stop this block
  */
  this.stop = function() {
    clearInterval(timer);
  };


  mapSection();
  pickColors();

  // Change the colors at a random interval between 4 - 10 seconds
  timer = setInterval(pickColors, 4000 + Math.round(Math.random() * 6000));
}

