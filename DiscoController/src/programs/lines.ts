import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';
import { FloorCell } from '../shared/floor-cell';
import { randomColor } from '../shared/program-utils';

const FADE_DURATION = 200;

const WAIT_TIMEOUT = 3000; // How many ms before starting wating program
const WAIT_ANIM_SPEED = 200;  // How fast the wait program will run

@Program({
	name: 'Lines',
	description: 'Stepping on the floor will light up entire lines (columns or rows)',
	interactive: true,
	miniumumTime: 1
})
class Lines implements IProgram {
	floorCellList:FloorCellList;

  litLines = {};

	isWaiting:boolean = false;
	waitingCountdown:number = 0;
  waitingOrientation:('row'|'col') = 'row'; // Are we animating columns or rows
  waitIdx = 0;

	lastTouch:number = 0;        // last time a cell was touched
 

	/**
	 * Start the program
	 */
	start(cellList: FloorCellList): Promise<void> {
		this.floorCellList = cellList;
    return this.floorCellList.fadeToColor([100, 100, 100], 1000);
	}

	/**
   * Shutdown the program
   */
  shutdown(): Promise<void> {
    return this.floorCellList.fadeToColor([0,0,0], 1000);
  }

  /**
   * Floor run loop
   */
  loop(time:number): void {
		let now = Date.now();
    let stepped = this.floorCellList.getTouched();

    if (stepped.length > 0) {
      this.lastTouch = now;
    }

    // Run wait program
		if (now - this.lastTouch > WAIT_TIMEOUT) {
      this.isWaiting = true;
			this.waiting(time);
		}
    else {
      this.stepProgram(stepped);
    }
	}

  /**
   * Light up a column or row where a person has stepped
   */
  stepProgram(steppedCells:FloorCell[]): void {
    let currLines = [];
    let newLines = [];

    // Reset from waiting
    if (this.isWaiting) {
      console.log('Reset');
      this.isWaiting = false;
      this.floorCellList.fadeToColor([100, 100, 100], FADE_DURATION);
    }

    // Organize lines
    steppedCells.forEach( (cell:FloorCell) => {
      let lineCode;

      // If y * x is even, we light the row
      if ((cell.y * cell.x) % 2) {
        lineCode = `row-${cell.y}`;
      } else {
        lineCode = `col-${cell.x}`;
      }

      // Register line color
      if (!this.litLines[lineCode]) {
        newLines[lineCode] = randomColor();
        currLines[lineCode] = newLines[lineCode];
      }
      else {
        currLines[lineCode] = this.litLines[lineCode];
      }
    });

    // Turn off old lines
    for (let lineCode in this.litLines) if (this.litLines.hasOwnProperty(lineCode)) {
      if (!currLines[lineCode]) {
        this.lightLine(lineCode, [100, 100, 100]);
      }
    }

    // Light new lines
    for (let lineCode in newLines) if (newLines.hasOwnProperty(lineCode)) {
      this.lightLine(lineCode, newLines[lineCode]);
    }

    this.litLines = currLines;
  }

	/**
	 * Do things while we're waiting for someone to step on the floor
	 */
	waiting(time:number): void {
    this.waitingCountdown -= time;
    if (this.waitingCountdown <= 0) {

      // Line overflow
      if (this.waitingOrientation === 'row' && this.waitIdx >= this.floorCellList.dimensions.y) {
        this.waitIdx = 0;
        this.waitingOrientation = 'col';
      }
      else if (this.waitingOrientation === 'col' && this.waitIdx >= this.floorCellList.dimensions.x) {
        this.waitIdx = 0;
        this.waitingOrientation = 'row';
      }

      // Color line
      let color = randomColor();
      this.floorCellList.fadeToColor([100, 100, 100], FADE_DURATION * 2);
      this.lightLine(`${this.waitingOrientation}-${this.waitIdx}`, color);
      
      this.waitIdx++;
      this.waitingCountdown += WAIT_ANIM_SPEED;
    }
	}

  /**
   * Light up a line of cells
   * 
   * @param {String} lineCode A code that determines the line in the format: `<orientation>-<index>`. (i.e. row-2)
   * @param {number[]} color The color for th line 
   */
  lightLine(lineCode:string, color:number[]): void {
    let lineCodeParts = lineCode.split('-');
    let orientation = lineCodeParts[0];
    let coordinate = parseInt(lineCodeParts[1]);
    let len = (orientation === 'row') ? this.floorCellList.dimensions.x : this.floorCellList.dimensions.y;

    for (let i = 0; i < len; i++) {
      try {
        if (orientation === 'row') {
          this.floorCellList.at(i, coordinate).fadeToColor(color, FADE_DURATION);
        }
        else {
          this.floorCellList.at(coordinate, i).fadeToColor(color, FADE_DURATION);
        }
      } catch(e) {
        console.error(e.message);
      }
    }
  }
};
module.exports = new Lines();
