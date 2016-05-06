/**
 * Represents a list of floor cells that you can interact
 * with all at once. The cells are listed in their physical
 * order on the floor.
 */

import { FloorCell } from './floor_cell';

export class FloorCellList {

  constructor(private cells: FloorCell[], private map: FloorCell[][]) {
  }

  /**
   * The number of cells in the list
   */
  get length(): number {
    return this.cells.length;
  }

  /**
   * Get a single cell by it's x/y position.
   */
  at(x:number, y:number): FloorCell {
    if (!this.map[x]) {
      return undefined;
    }
    return this.map[x][y];
  }

  /**
   * Get a cell from it's index position.
   */
  atIndex(index: number): FloorCell {
    return this.cells[index];
  }

  /**
   * Set a solid, unfading, color for all cells.
   * @param {byte[]} color An array of colors.
   */
  setColor(color:[number, number, number]) {
    for (let cell of this.cells) {
      cell.setColor(color);
    };
  }

  /**
   * Fade all cells to a color.
   * @param {byte[]} color The color to fade to.
   * @param {number} duration The time, in milliseconds, it should take to fade to this color.
   */
  fadeToColor(color: [number, number, number], duration: number) {
    for (let cell of this.cells) {
      cell.fadeToColor(color, duration);
    };
  }
}