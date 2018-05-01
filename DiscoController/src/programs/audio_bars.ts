import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';
import { audio } from '../shared/audio';

const CHANGE_COLOR_MS = 4000;

@Program({
  name: 'Audio Bars',
  description: 'An audio visualization that displays the audio levels as bars.',
  interactive: false,
  miniumumTime: 1
})
class AudioBars implements IProgram {
  floorCellList:FloorCellList;

  barColorSource:number[] = [255, 0, 0];
  barColorSelect:number = 0;

  bgColorSource:number[] = [0, 127, 255];
  bgColorSelect:number = 2;

  colorChangeCountdown:number = CHANGE_COLOR_MS;
  colorChangeCount:number = 0;

  /**
   * Start the program
   */
  start(cellList: FloorCellList): Promise<void> {
    this.floorCellList = cellList;

    // Determine fft size by width of floor
    audio.analyser.fftSize = 32;
    while (audio.analyser.fftSize < cellList.dimensions.x) {
      audio.analyser.fftSize *= 2;
    }

    return Promise.resolve();
  }

  /**
   * Shutdown the program
   */
  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Floor run loop
   */
  loop(time:number): void {

    this.colorChangeCountdown -= time;
    if (this.colorChangeCountdown <= 0) {
      this.changeColors();
      this.colorChangeCountdown += CHANGE_COLOR_MS;
    }

    this.buildAudioBars();
  }

  /**
  * Get processed audio data and convert it to audio bars
  */
  buildAudioBars(): void {
    let dimensions = this.floorCellList.dimensions,
        allData = new Uint8Array(audio.analyser.frequencyBinCount),
        xData = new Uint8Array(dimensions.x),
        heightScale = dimensions.y / 255,
        barColor = this.barColorSource.slice(0),
        bgColor = this.bgColorSource.slice(0);

    audio.analyser.getByteFrequencyData(allData);

    // Evenly group data along the x axis
    if (allData.length > dimensions.x) {
      let chunking = Math.floor(allData.length / dimensions.x);
      for (let i = 0, n = 0; i < allData.length; i += chunking) {
        xData[n++] = allData[i];
      }
    }

    // Set secondary color intesity based on data at x:3
    for (let c = 0; c < 3; c++) {
      bgColor[c] = Math.round(bgColor[c] * (xData[3] / 255));
    }

    // Create bars along the x axis that display the audio intensity
    for (let x = 0, xLen = dimensions.x; x < xLen; x++) {
      let percent = xData[x] / 255; // percent of the max value
      let height = Math.round(xData[x] * heightScale);

      // Set the color as a percentage of the audio value
      for (let i = 0; i < 3; i++) {
        barColor[i] = Math.round(barColor[i] * percent);
      }

      if (height > dimensions.y) {
        height = dimensions.y;
      }
      if (barColor[this.barColorSelect] < 50) {
        barColor[this.barColorSelect] = 50;
      }

      // Fill each column with bars and background
      for (let y = 0, yLen = dimensions.y; y < yLen; y++) {
        let cell = this.floorCellList.at(x, y);

        if (!cell) continue;

        if (y <= height) {
          cell.setColor(barColor);
        } else {
          cell.setColor(bgColor);
        }
      }
    }
  }

  /**
   * Choose new source colors to use for bars and background.
   * Each color is only changed every other time this is called.
   *
   * Color change works as a simple cross fade.
   * The currently selected color changes from 255 to 127 and the
   * next color goes to 255.
   */
  changeColors(): void {

    // Change bar color
    if (this.colorChangeCount % 2 === 0) {
      this.barColorSource = [0, 0, 0];

      // Simple cross fade
      this.barColorSource[this.barColorSelect] = 127;
      this.barColorSelect = (++this.barColorSelect > 2) ? 0 : this.barColorSelect;
      this.barColorSource[this.barColorSelect] = 255;
    }
    else {
      this.bgColorSource = [0, 0, 0];

      // Simple cross fade
      this.bgColorSource[this.bgColorSelect] = 127;
      this.bgColorSelect = (++this.bgColorSelect > 2) ? 0 : this.bgColorSelect;
      this.bgColorSource[this.bgColorSelect] = 255;
    }

    this.colorChangeCount++;
  }
}

module.exports = new AudioBars();
