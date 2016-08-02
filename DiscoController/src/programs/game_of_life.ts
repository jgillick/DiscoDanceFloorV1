import { IProgram, Program } from '../shared/program';
import { FloorCell } from '../shared/floor-cell';
import { FloorCellList } from '../shared/floor-cell-list';
import { randomColor, randomNumber } from '../shared/program-utils';

const GENERATION_TIMER      = 1000;
const COLOR_CHANGE_TIMER    = 3000;

const BIRTH_ANIMATION_TIME  = 1000;
const DEATH_ANIMATION_TIME  = 1500;
const RESEED_ANIMATION_TIME = 800;

@Program({
  name: 'Game of Life',
  description: "Interactive Conway's Game of Life. Cells that are touched cannot die.",
  interactive: true,
  miniumumTime: 2
})
class LifeGame implements IProgram {
  floorCellList:FloorCellList;
  livingCells:boolean[][] = [];
  livingColor:number[] = [0, 0, 255];

  generationCountdown:number;
  colorChangeCountdown:number;

  /**
   * Start the program
   */
  start(cellList: FloorCellList): Promise<void> {
    this.floorCellList = cellList;
    this.generationCountdown = GENERATION_TIMER;
    this.colorChangeCountdown = COLOR_CHANGE_TIMER;

    let fadeIn = this.floorCellList.fadeToColor([50, 50, 50], 1000);
    fadeIn.then( () => this.seed());
    return fadeIn;
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
    this.generationCountdown -= time;
    this.colorChangeCountdown -= time;

    // Check if it's time to loop
    if (this.generationCountdown > 0) {
      return;
    }
    this.generationCountdown = GENERATION_TIMER + this.generationCountdown;

    // Change living color
    if (this.colorChangeCountdown <= 0) {
      this.changeLivingColor();
      this.colorChangeCountdown = COLOR_CHANGE_TIMER + this.colorChangeCountdown;
    }

    // Bring touched cells to live
    for (let cell of this.floorCellList.getTouched()) {
      this.birth(cell);
    }

    // Generation - Birth & Kill cells
    let changed = 0;
    for (let cell of this.floorCellList) {
      let isAlive = this.isAlive(cell.x, cell.y),
          neighbors = this.countAliveNeighbors(cell);

      if (isAlive && (neighbors < 2 || neighbors > 3) && !cell.sensorValue) {
        this.kill(cell);
        changed++;
      }
      else if (!isAlive && neighbors === 3) {
        this.birth(cell);
        changed++;
      }
    }

    // If no changes, reseed the floor
    if (changed === 0) {
      this.livingCells = [];
      this.floorCellList.fadeToColor([50, 50, 50], RESEED_ANIMATION_TIME);
      this.seed();
    }
  }

  /**
   * Seed the floor with a few live cells
   */
  seed(): void {
    let cellCount = this.floorCellList.length,
        spawnCount = Math.floor(cellCount * 0.05),
        spawnCells = this.floorCellList.getTouched();

    if (spawnCount === 0) {
      spawnCount = 1;
    }

    // Randomly choose more cells to birth
    for (let i = spawnCells.length - 1; i < spawnCount; i++) {
      let cellIdx = randomNumber(0, cellCount - 1);
      spawnCells.push(this.floorCellList.atIndex(cellIdx));
    }

    // Bring these cells to live and a few random cells around each
    for(let cell of spawnCells) {
      this.birth(cell);

      // Birth a neighbors
      let startDir = randomNumber(0, 3);
      for (let n = 0; n < 4; n++) {
        let neighbor,
            dir = randomNumber(0, 7);

        switch (dir) {
          case 0: // north
            neighbor = this.floorCellList.at(cell.x, cell.y - 1);
          break
          case 1: // north-east
            neighbor = this.floorCellList.at(cell.x + 1, cell.y - 1);
          break
          case 2: // east
            neighbor = this.floorCellList.at(cell.x + 1, cell.y);
          break
          case 3: // south-east
            neighbor = this.floorCellList.at(cell.x + 1, cell.y + 1);
          break
          case 4: // south
            neighbor = this.floorCellList.at(cell.x, cell.y + 1);
          break
          case 5: // south-west
            neighbor = this.floorCellList.at(cell.x - 1, cell.y + 1);
          break
          case 6: // west
            neighbor = this.floorCellList.at(cell.x - 1, cell.y);
          break
          case 7: // north-west
            neighbor = this.floorCellList.at(cell.x - 1, cell.y - 1);
          break
        }

        if (neighbor) {
          this.birth(neighbor);
        }
      }
    }
  }

  /**
   * Bring a single cell to life
   *
   * @param {FloorCell} cell The cell to bring to life
   */
  birth(cell:FloorCell): void {
    if (this.isAlive(cell.x, cell.y)) return;

    cell.fadeToColor(this.livingColor, BIRTH_ANIMATION_TIME);

    if (!this.livingCells[cell.x]) {
      this.livingCells[cell.x] = [];
    }
    this.livingCells[cell.x][cell.y] = true;
  }

  /**
   * Kill a single cell
   *
   * @param {FloorCell} cell The cell to bring to kill
   */
  kill(cell:FloorCell): void {
    cell.fadeToColor([125, 0, 0], DEATH_ANIMATION_TIME);
    this.livingCells[cell.x][cell.y] = false;
  }

  /**
   * Check if a cell at an x/y cordinate is alive.
   */
  isAlive(x:number, y:number): boolean {
    return (this.livingCells[x] && this.livingCells[x][y] === true)
  }

  /**
   * Count the numbers of neighbors around this cell are alive.
   *
   * * @param {FloorCell} cell
   */
  countAliveNeighbors(cell:FloorCell): number {
    let x = cell.x,
        y = cell.y,
        count = 0;

    if (this.isAlive(x-1, y-1)) count++;
    if (this.isAlive(x,   y-1)) count++;
    if (this.isAlive(x+1, y-1)) count++;
    if (this.isAlive(x-1, y  )) count++;
    if (this.isAlive(x+1, y  )) count++;
    if (this.isAlive(x-1, y+1)) count++;
    if (this.isAlive(x,   y+1)) count++;
    if (this.isAlive(x+1, y+1)) count++;

    return count;
  }

  /**
   * Change the color of newly birthded cells
   */
  changeLivingColor(): void {
    this.livingColor = randomColor({ max: {
      r: 100,
      g: 255,
      b: 255
    }});
  }
}
module.exports = new LifeGame();