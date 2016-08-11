import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';

const RAIN_SPEED_MS = 90;    // How slow the rain moves
const RAIN_FREQUENCY = 0.10; // How often new rain starts in a column

const COLOR_CHANGE_MS = 800;
const FADE_TIME = 50;
const FADE_MULTIPLIER = 0.08;

const COLOR_LIST = [
  [0,   255, 0],   // Green
  [130, 215, 190], // Teal
  [255, 140, 0],   // Orange
  [255, 0,   0],   // Red
  [0,   0,   255], // Blue
  [255, 255, 0],   // Yellow
  [255, 0,   255]  // Purple
];

@Program({
  name: 'Rain',
  description: 'Rains color down from above',
  interactive: false,
  miniumumTime: 1
})
class Rain implements IProgram {
  floorCellList:FloorCellList;

  rainCountdown:number;
  colorCountdown:number;

  columnIdx:number[];
  columnColors:number[][];
  columnMaxHeight:number;

  newColumnCount:number;
  colorSelect:number = 0;

  /**
   * Start the program
   */
  start(cellList: FloorCellList): Promise<void> {
    this.floorCellList = cellList;
    this.rainCountdown = RAIN_SPEED_MS;
    this.colorCountdown = COLOR_CHANGE_MS;

    this.columnIdx = new Array(cellList.dimensions.x);
    this.columnColors = new Array(cellList.dimensions.x);
    this.columnMaxHeight = cellList.dimensions.y;

    this.newColumnCount = 0;

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

    this.rainCountdown -= time;
    if (this.rainCountdown <= 0) {
      this.fadeDrops();
      this.makeItRain();

      this.rainCountdown += RAIN_SPEED_MS;
    }

    this.colorCountdown -= time;
    if (this.colorCountdown <= 0) {
      this.changeColor();
      this.colorCountdown += COLOR_CHANGE_MS;
    }
    
  }

  /**
   * Create rain drops
   */
  makeItRain(): void {
    for (let i = 0; i < this.columnIdx.length; i++) {
      this.rainColumn(i);
    }
  }

  /**
   * Move rain down a column
   * 
   * @param {number} col The column number
   */
  rainColumn(col:number): void {
    let row = this.columnIdx[col],
        cell;

    // Start new a rain drop in the column
    if (row === undefined || row >= this.columnMaxHeight) {
      if (Math.random() <= RAIN_FREQUENCY) {
        this.columnIdx[col] = 0;
        row = 0;
      }
      else {
        return;
      }
    }

    // Move rain down a column
    cell = this.floorCellList.at(col, row);
    if (!cell) return;

    // New rain
    if (row === 0) {
      this.columnColors[col] = COLOR_LIST[this.colorSelect];
    }

    // Set color and move on
    cell.fadeToColor(this.columnColors[col], FADE_TIME);
    this.columnIdx[col]++;
  }

  /**
   * Fade out drops that have hit.
   * This means that the older the color is, the dimmer it gets,
   * which provides a nice looking trail.
   */
  fadeDrops(): void {
    for (let cell of this.floorCellList) {
      let color = cell.color;
      for (let i = 0; i < 3; i++) {
        color[i] -= Math.round(color[i] * FADE_MULTIPLIER);
      }
      cell.fadeToColor(color, FADE_TIME);
    }
  }

  /**
   * Change the rain color
   */
  changeColor(): void {
    this.colorSelect++;
    if (this.colorSelect > 2) {
      this.colorSelect = 0;
    }
  }
}

module.exports = new Rain();
