'use strict';

import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';
import { audio } from '../shared/audio';

const CHANGE_COLOR_MS = 2000;

let cellList:FloorCellList;
let countdown:number = CHANGE_COLOR_MS;
let dataStart:number = 0;

@Program({
  name: "Audio Color",
  description: 'Changes the color of the floor with the audio',
  audio: true,
  interactive: false,
  miniumumTime: 0.5
})
class AudioColor implements IProgram {
    
  /**
   * Start the program
   */
  start(_cellList:FloorCellList) {
    cellList = _cellList;
    return cellList.fadeToColor([0,0,0], 1000);
  }
  
  /**
   * Shutdown the program
   */
  shutdown() {
    return Promise.resolve();
  }

  /**
   * Run loop
   */
  loop(time:number) {
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
}

/**
 * Update the color with the current audio data
 */
function audioColor(){
  let data = new Uint8Array(audio.analyser.frequencyBinCount),
      len = data.length,
      color:[number, number, number] = [0,0,0],
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

/**
 * Export instance of program
 */
module.exports = new AudioColor();
