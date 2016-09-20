import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';
import { FloorCell } from '../shared/floor-cell';
import { randomColor, randomNumber } from '../shared/program-utils';

@Program({
  name: 'Random Colors',
  description: 'Fades random colors across the floor.',
  interactive: false,
  miniumumTime: 0.5
})
class RandomColors implements IProgram {

  floorCellList:FloorCellList;

  /**
   * Start the program
   */
  start(cellList: FloorCellList): Promise<void> {
    this.floorCellList = cellList;
    return this.floorCellList.fadeToColor([20, 20, 20], 1000);
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
    for (let cell of this.floorCellList) {
      if (!cell.isFading) {
        this.fadeToNewColor(cell);
      }
    }
  }

  /**
   * Start fading a cell to a new color
   */
  fadeToNewColor(cell: FloorCell): void {
    let color:number[] = [],
        duration = randomNumber(800, 2000);

    // Fade off or white
    if (randomNumber(1, 4) === 1) {

      if (randomNumber(1, 4) === 1) {
        color = [200, 200, 200];
      } else {
        color = [0,0,0];
      }
    }
    // Random color
    else {
      color = randomColor();
    }

    // Start fade
    cell.fadeToColor(color, duration);
  }
}
module.exports = new RandomColors();
