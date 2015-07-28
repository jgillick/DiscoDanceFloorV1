'use strict';

var Promise = require("bluebird"),
    audio = require('../javascript/audio.js'),
    discoUtils = require('../lib/utils.js');

var floorController = null,
    dataStart = 0,
    running = false,
    timer;

module.exports = {

  info: {
    name: 'Audio Color',
    description: 'Changes the color of the floor with the audio',
    audio: true,
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
    clearInterval(timer);
    return floorController.changeAllCells([0,0,0], 500);
  },

  /**
    Run the program
  */
  run: function(){
    running = true;
    audioColor();

    timer = setInterval(function() {
      dataStart++;

      // Past the upper 80%
      if (dataStart >= audio.analyser.frequencyBinCount){
        dataStart = 0;
      }
    }, 800);
  }
};

/**
  Update the color with the current audio data
*/
function audioColor(){
  if (!running) return;

  var data = new Uint8Array(audio.analyser.frequencyBinCount),
      len = data.length,
      color = [0,0,0],
      chunks;

  audio.analyser.getByteFrequencyData(data);

  chunks = Math.floor(len / 3);
  for (var c = 0, d = dataStart; c < 3; c++) {
    d = discoUtils.wrap(d + chunks, len);
    color[c] = data[d];
  }

  // Minimum color
  if (color[0] + color[1] + color[2] < 30) {
    color = [30, 30, 30];
  }

  floorController.changeAllCells(color);

  window.requestAnimationFrame(audioColor);
}