'use strict';

import {audio} from '../shared/audio';

const CHANGE_COLOR_MS = 2000;

let cellList;
let countdown = CHANGE_COLOR_MS;
let dataStart = 0;

module.exports = {
  info: {
    name: 'Audio Color',
    description: 'Changes the color of the floor with the audio',
    audio: true,
    interactive: false,
    miniumumTime: 0.5
  },
    
  /**
   * Start the program
   */
  start: function(_cellList) {
    cellList = _cellList;
    return cellList.fadeToColor([0,0,0], 1000);
  },
  
  /**
   * Shutdown the program
   */
  shutdown: function() {
    return Promise.resolve();
  },

  /**
   * Run loop
   */
  loop: function(time) {
    audioColor();
    
    // Every 800ms change the datat section that is defining the color
    countdown -= time;
    if (countdown <= 0) {
      dataStart++;
      countdown += CHANGE_COLOR_MS;

      // Past the upper 80%, start over
      if (dataStart >= audio.analyser.frequencyBinCount){
        dataStart = 0;
      }
    }
  }
};

/**
 * Update the color with the current audio data
 */
function audioColor(){
  let data = new Uint8Array(audio.analyser.frequencyBinCount),
      len = data.length,
      color = [0,0,0],
      chunks;

  audio.analyser.getByteFrequencyData(data);

  // Divide the data into 3 chunks, one for each color
  chunks = Math.floor(len / 3);
  for (var c = 0, d = dataStart; c < 3; c++) {
    d = (d + chunks) % len; // warp number
    color[c] = data[d];
  }

  // Ensure a minimum color
  if (color[0] + color[1] + color[2] < 30) {
    color = [30, 30, 30];
  }

  cellList.setColor(color);
}