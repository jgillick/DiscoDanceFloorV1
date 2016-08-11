import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';

const CHANGE_MODE_MS = 3000;
const SPEED_MS = 600;
const RUNNING_COLOR_SPEED_MS = 100;

const COLOR_FADE_MS = 300;
const RUNNING_COLOR_FADE_MS = 100;

const MODE_COUNT = 3;

const COLOR_LIST = [
  [0,   0,   0],   // Black
  [0,   0,   255], // Blue
  [255, 0,   0],   // Red
  [255, 255, 0],   // Yellow
  [255, 0,   255], // Purple
  [130, 215, 190], // Teal
  [0,   255, 0],   // Green
  [255, 140, 0],   // Orange
  [0,   234, 255], // Cyan
  [255, 255, 255]  // White
];

@Program({
  name: 'Rings',
  description: 'Creates rings of color that flash and run',
  interactive: false,
  miniumumTime: 1
})
class Rings implements IProgram {
  floorCellList:FloorCellList;
  floorMap:number[][][];

  mode:number;

  runCountdown:number;
  changeModeCountdown:number;

  modeState:any;
  runningRingsDir:number = 1;

  /**
   * Start the program
   */
  start(cellList: FloorCellList): Promise<void> {
    this.floorCellList = cellList;

    this.mode = -1;

    this.runCountdown = SPEED_MS;
    this.changeModeCountdown = CHANGE_MODE_MS;

    this.floorMap = [];
    this.mapFloorRings();
    return cellList.fadeToColor([0,0,0], SPEED_MS);
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

    // Change program mode
    this.changeModeCountdown -= time;
    if (this.changeModeCountdown <= 0) {

      this.changeModeCountdown += CHANGE_MODE_MS;
    }

    // Run program
    this.runCountdown -= time;
    if (this.runCountdown <= 0) {
      this.runCountdown += SPEED_MS;
      this.runMode();
    }
  }

  /**
   * Run the selected mode
   */
  runMode(): void {
    switch (this.mode) {
      case -1:
        this.introMode();
        break;
      case 0:
        this.alternatingRings();
        break;
      case 1:
        this.runningRings();
        this.runCountdown = RUNNING_COLOR_SPEED_MS;
        break;
      case 2:
        this.blinkFloor();
        break;
    }
  }

  /**
   * Move to the next mode.
   * 
   * @param {boolean} runImmediately Run the new mode immediately
   */
  nextMode(runImmediately:boolean): void {
    this.mode++;
    if (this.mode >= MODE_COUNT) {
      this.mode = 0;
    }

    this.modeState = null;
    if (runImmediately) {
      this.runCountdown = CHANGE_MODE_MS;
      this.runMode();
    }
  }

  /**
   * This mode is only run once and lights the rings from the outside in
   */
  introMode(): void {

    // Init a new state for this mode
    if (!this.modeState) {
      console.log('Intro');
      this.modeState = {
        ring: 0,
        color: 1
      };
    }

    // Light the current ring
    let ring = this.floorMap[this.modeState.ring];
    let color = COLOR_LIST[this.modeState.color];
    for (let i = 0; i < ring.length; i++) {
      let cell = this.floorCellList.at(ring[i][0], ring[i][1]);
      if (!cell) continue;
      cell.fadeToColor(color, COLOR_FADE_MS);
    }

    // Increment ring and color
    this.modeState.ring++;
    this.modeState.color++;
    if (this.modeState.color >= COLOR_LIST.length) {
      this.modeState.color = 0;
    }

    // All done when we've gone through once
    if (this.modeState.ring >= this.floorMap.length) {
      this.nextMode(false);
    }
  }

  /**
   * Light ever-other ring
   */
  alternatingRings(): void {
    let colorIndex = 0,
        ring, color, cell;

    // Init new mode state
    if (!this.modeState) {
      console.log('Alternating');
      this.modeState = {
        oddEven: 0,
        cycle: 0
      };
    }

    // Loop through rings
    for (var i = 0; i < this.floorMap.length; i++) {
      ring = this.floorMap[i];

      colorIndex = (colorIndex + 1 < COLOR_LIST.length) ? ++colorIndex : 1;
      color = COLOR_LIST[colorIndex];

      // Turn off ever other ring
      if (i % 2 != this.modeState.oddEven) {
        color = [0, 0, 0];
      }

      // Apply color to all cells
      for (var c = 0; c < ring.length; c++) {
        cell = this.floorCellList.at(ring[c][0], ring[c][1]);
        if (!cell) continue;
        cell.fadeToColor(color, COLOR_FADE_MS);
      }
    }

    this.modeState.oddEven = (this.modeState.oddEven == 1) ? 0 : 1;
    this.modeState.cycle++;

    // Done after 4 cycles
    if (this.modeState.cycle > 4) {
      this.nextMode(false);
    } 
  }

  /**
   * Run the rings outward
   */
  runningRings(): void {

    // Init new mode state
    if (!this.modeState) {
      this.runningRingsDir *= -1;
      this.modeState = {
        color: 0,
        ringColors: [],
        ring: (this.runningRingsDir < 0) ? this.floorMap.length - 1 : 0,
        cycle: 0
      };
    }

    // Set ring color
    let ring = this.floorMap[this.modeState.ring];
    if (this.modeState.color == this.modeState.ringColors[this.modeState.ring]) {
      incrementModeColor.apply(this);
    }
    let color = COLOR_LIST[this.modeState.color];
    this.modeState.ringColors[this.modeState.ring] = this.modeState.color;

    // Fade ring to this color
    for (let c = 0; c < ring.length; c++) {
      let cell = this.floorCellList.at(ring[c][0], ring[c][1]);
      if (!cell) continue;
      cell.fadeToColor(color, RUNNING_COLOR_FADE_MS);
    }

    this.modeState.ring += this.runningRingsDir;
    this.modeState.color = (this.modeState.color + 1 < COLOR_LIST.length) ? ++this.modeState.color : 0;

    // New cycle
    if (this.modeState.ring < 0 || this.modeState.ring >= this.floorMap.length) {
      this.modeState.ring = (this.runningRingsDir < 0) ? this.floorMap.length - 1 : 0;
      this.modeState.cycle++;

      incrementModeColor.apply(this);

      // Done after 4 cycles
      if (this.modeState.cycle > 4) {
        this.nextMode(false);
      }
    }

    // Increment the mode state color
    function incrementModeColor() {
      this.modeState.color += 2;
      if (this.modeState.color > COLOR_LIST.length) {
        this.modeState.color = 0;
      } 
    }
  }

  /**
   * Blink entire floor on and off
   */
  blinkFloor(): void {

    // Init new mode
    if (!this.modeState) {
      this.modeState = {
        cycle: 0
      };
    }

    let on = (this.modeState.cycle % 2 === 0),
        colorIndex = 0;
    for (var i = 0; i < this.floorMap.length; i++) {
      let ring = this.floorMap[i],
          color;

      if (on) {
        colorIndex = (colorIndex + 1 < COLOR_LIST.length) ? ++colorIndex : 0;
        color = COLOR_LIST[colorIndex];
      } else {
        color = [0,0,0];
      }

      for (var c = 0; c < ring.length; c++) {
        let cell = this.floorCellList.at(ring[c][0], ring[c][1]);
        if (!cell) continue;
        cell.fadeToColor(color, COLOR_FADE_MS);
      }
    }

    this.modeState.cycle++;

    // Done after 5 cycles
    if (this.modeState.cycle > 5) {
      this.nextMode(false);
    }
  }

  /**
   * Map the floor to various square rings starting from the outside in
   */
  mapFloorRings(): void {
    let dimensions = this.floorCellList.dimensions,
        xMax = dimensions.x,
        yMax = dimensions.y,
        ringNum = 0;

    // Figure out how many rings there are
    ringNum = (dimensions.x > dimensions.y) ? dimensions.y : dimensions.x;
    ringNum = Math.ceil(ringNum / 2);

    xMax--;
    yMax--;

    // Map all rings
    for (let i = 0; i < ringNum; i++) {
      this.floorMap[i] = [];

      for(let x = i; x <= xMax - i; x++) {
        this.floorMap[i].push([x, i]);
        this.floorMap[i].push([x, yMax - i]);
      }
      for(let y = i; y <= yMax - i; y++) {
        this.floorMap[i].push([i, y]);
        this.floorMap[i].push([xMax - i, y]);
      }
    }
  }
}

module.exports = new Rings();
