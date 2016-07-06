import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';
import { FloorCell } from '../shared/floor-cell';
import { randomColor } from '../shared/program-utils';

const FADE_ON_DURATION = 500;
const FADE_OFF_DURATION = 2000;
const COLOR_CHANGE_TIME = 10000;

var floorCellList:FloorCellList,
		touchedCells:boolean[] = [],
		onColor:number[],
		offColor:[number, number, number] = [50, 50, 50],
		colorChangeCountdown:number;

@Program({
	name: 'Step Trails',
	description: 'Lights up each step and slowly fades out when stepped off.',
	interactive: true,
	miniumumTime: 1
})
class StepTrails implements IProgram {
	
	/**
	 * Start the program
	 */
	start(cellList: FloorCellList): Promise<void> {
		floorCellList = cellList;
		onColor = [255, 0, 0];
		touchedCells = [];
		colorChangeCountdown = COLOR_CHANGE_TIME;
    return floorCellList.fadeToColor(offColor, 1000);
	}

	/**
   * Shutdown the program
   */
  shutdown(): Promise<void> {
    return floorCellList.fadeToColor([0,0,0], 1000);
  }

  /**
   * Floor run loop
   */
  loop(time:number): void {
		colorChangeCountdown -= time;

		// Change color
		if (colorChangeCountdown <= 0) {
			onColor = randomColor();
			colorChangeCountdown = COLOR_CHANGE_TIME;
		}
		
		// Fade touched cells
		for (var i = 0; i < floorCellList.length; i++) {
			let cell:FloorCell = floorCellList.atIndex(i);

			// Sensor is no longer being touched
			if (touchedCells[i] === true) {
				if (!cell.sensorValue) {
					touchedCells[i] = false;
					cell.fadeToColor(offColor, FADE_OFF_DURATION);
				}
			}
			// New touch
			else if (cell.sensorValue) {
				touchedCells[i] = true;
				cell.fadeToColor(onColor, FADE_ON_DURATION);
			}
		}
	}
};
module.exports = new StepTrails();
