import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';

@Program({
  name: 'Audio Blocks',
  description: 'Pulse color to the audio in 4 blocks on the floor',
  interactive: false,
  miniumumTime: 1,
  disabled: true
})
class AudioBlocks implements IProgram {
  floorCellList:FloorCellList;

  /**
   * Start the program
   */
  start(cellList: FloorCellList): Promise<void> {
    this.floorCellList = cellList;
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
  }
}

module.exports = new AudioBlocks();
