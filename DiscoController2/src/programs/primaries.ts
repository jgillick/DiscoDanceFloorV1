import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';

var floorCellList,
    loopCountdown,
    modeCountdown,
    programMode = 0,
    startColor = 0,
    solidModeColor = 0,
    flashingState = 0;

const LOOP_TIME = 750
const ANIMATION_TIME = 500;
const CHANGE_MODE_TIME = 6000;

@Program({
  name: 'Primaries',
  description: 'Fades in primary colors, chasing from one cell to the next',
  interactive: false,
  miniumumTime: 1
})
class Primaries implements IProgram {
  private _programModes = [];

  /**
   * Start the program
   */
  start(cellList: FloorCellList): Promise<void> {
    floorCellList = cellList;
    startColor = 0;
    solidModeColor = 0;
    loopCountdown = 0;
    programMode = 0;
    flashingState = 1;
    modeCountdown = CHANGE_MODE_TIME;

    this._programModes = [
      this.alternatingColorMode,
      this.flashingAlternatingCellMode,
      this.flashingSolidMode
    ]
    
    return floorCellList.fadeToColor([0,0,0], ANIMATION_TIME);
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
    loopCountdown -= time;
    modeCountdown -= time;

    if (loopCountdown > 0) {
      return;
    }
    loopCountdown = LOOP_TIME + loopCountdown;

    // Run programs
    this._programModes[programMode]();

    // Change mode
    if (modeCountdown <= 0) {
      programMode++;
      if (programMode >= this._programModes.length) {
        programMode = 0;
      }
      modeCountdown = CHANGE_MODE_TIME;
    }
  }

  /**
   * Alternate red, green, blue across all floor cells
   */
  alternatingColorMode() {
    let colorIndex = startColor,
        dimensions = floorCellList.dimensions;

    for (let y = 0; y < dimensions.y; y++) {
      for (let x = 0; x < dimensions.x; x++) {
        let color = [0, 0, 0],
            cell = floorCellList.at(x, y);
        
        if (!cell) continue;

        color[colorIndex] = 255;
        cell.fadeToColor(color, ANIMATION_TIME);

        if (++colorIndex > 2) {
          colorIndex = 0;
        }
      }
    }

    if (++startColor > 2) {
      startColor = 0;
    }
  }

  /**
   * Flash all cells (alternating R, G, B)off and on
   */
  flashingAlternatingCellMode() {
    let colorIndex = startColor,
        dimensions = floorCellList.dimensions;

    for (let y = 0; y < dimensions.y; y++) {
      for (let x = 0; x < dimensions.x; x++) {
        let color = [0, 0, 0],
            cell = floorCellList.at(x, y);
        
        if (!cell) continue;

        if (flashingState == 1) {
          color[colorIndex] = 255;
        } 
        cell.fadeToColor(color, ANIMATION_TIME);

        if (++colorIndex > 2) {
          colorIndex = 0;
        }
      }
    }

    flashingState = (flashingState === 1) ? 0 : 1;
  }

  /**
   * Flash solid R, G, B colors
   */
  flashingSolidMode() {
    let color = [0, 0, 0];

    color[solidModeColor] = 255;
    floorCellList.fadeToColor(color, ANIMATION_TIME);

    solidModeColor++;
    if (solidModeColor > 2) {
      solidModeColor = 0;
    }
  }
}
module.exports = new Primaries();
