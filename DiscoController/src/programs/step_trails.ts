import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';
import { FloorCell } from '../shared/floor-cell';
import { randomColor } from '../shared/program-utils';

const FADE_ON_DURATION  = 500;
const FADE_OFF_DURATION = 2000;
const COLOR_CHANGE_TIME = 10000;

const WAIT_TIMEOUT   = 8000; // How many seconds before starting wait fade
const WAIT_FADE_TIME = 2000; // Wait fade speed.

@Program({
	name: 'Step Trails',
	description: 'Lights up each step and slowly fades out when stepped off.',
	interactive: true,
	miniumumTime: 1
})
class StepTrails implements IProgram {
	
	floorCellList:FloorCellList;

	touchedCells:boolean[] = []; // Array of the sensor value for all cells
	lastTouch:number = 0;        // last time a cell was touched
	colorChangeCountdown:number; // Countdown to changing the color touched cells fade to
	
	onColor:[number, number, number]; // Color of touched cells
	offColor:[number, number, number] = [50, 50, 50]; // Color of cells in their off state.

	isWaitFading:boolean = false;
	waitFadingTimeout:number = 0;
	waitFadeDirection:number = -1; 

	/**
	 * Start the program
	 */
	start(cellList: FloorCellList): Promise<void> {
		this.floorCellList = cellList;
		this.onColor = [255, 0, 0];
		this.touchedCells = [];
		this.colorChangeCountdown = COLOR_CHANGE_TIME;
		this.lastTouch = Date.now();
    return this.floorCellList.fadeToColor(this.offColor, 1000);
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

		this.colorChangeCountdown -= time;
		this.waitFadingTimeout -= time;

		if (now - this.lastTouch > WAIT_TIMEOUT) {
			this.waitFade();
		}

		// Change color
		if (this.colorChangeCountdown <= 0) {
			this.onColor = randomColor();
			this.colorChangeCountdown = COLOR_CHANGE_TIME;
		}
		
		// Fade touched cells
		for (var i = 0; i < this.floorCellList.length; i++) {
			let cell:FloorCell = this.floorCellList.atIndex(i);

			// Sensor is no longer being touched
			if (this.touchedCells[i] === true) {
				if (!cell.sensorValue) {
					this.touchedCells[i] = false;
					cell.fadeToColor(this.offColor, FADE_OFF_DURATION);
				}
			}
			// New touch
			else if (cell.sensorValue) {
				this.stopWaitFade();
				this.lastTouch = Date.now();
				this.touchedCells[i] = true;
				cell.fadeToColor(this.onColor, FADE_ON_DURATION);
			}
		}
	}

	/**
	 * Pulse the floor while we're waiting for someone to step on it.
	 */
	waitFade(): void {
		// Verify nothing is being touched
		for (var i = 0; i < this.floorCellList.length; i++) {
			if (this.floorCellList.atIndex(i).sensorValue == true) {
				this.lastTouch = Date.now();
				return;
			}
		}

		// Fade entire floor on and off
		this.isWaitFading = true;
		if (this.waitFadingTimeout < 0) {
			this.waitFadeDirection *= -1;
			this.waitFadingTimeout = WAIT_FADE_TIME;

			if (this.waitFadeDirection > 0) {
				this.floorCellList.fadeToColor([200, 200, 200], WAIT_FADE_TIME * 0.9);
			} else {
				this.floorCellList.fadeToColor([10, 10, 10], WAIT_FADE_TIME * 0.9);
			}
		}
	}

	/**
	 * Stop the wait fader and fade all non-touched cells back to off
	 */
	stopWaitFade(): void {
		if (this.isWaitFading) {
			this.isWaitFading = false;
			this.floorCellList.fadeToColor(this.offColor, FADE_OFF_DURATION);
		}
	}
};
module.exports = new StepTrails();
