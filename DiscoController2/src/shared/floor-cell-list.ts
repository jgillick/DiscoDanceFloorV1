/**
 * Represents a list of floor cells that you can interact
 * with all at once. The cells are listed in their physical
 * order on the floor.
 */

import { FloorCell } from './floor-cell';

export class FloorCellList {

  constructor(private _cells: FloorCell[], 
              private _map: FloorCell[][], 
              private _x: number, 
              private _y: number) {
  }

  /**
   * The number of cells in the list
   */
  get length(): number {
    return this._cells.length;
  }
  /**
   * Get the floor dimensions as an x/y object.
   * @return {Object} An object with x, y and num properties
   */
  get dimensions(): {x:number, y:number} {
    return {
      x: this._x,
      y: this._y
    }
  }

  /**
   * Get a single cell by it's x/y position.
   */
  at(x:number, y:number): FloorCell {
    if (!this._map[x]) {
      return undefined;
    }
    return this._map[x][y];
  }

  /**
   * Get a cell from it's index position.
   */
  atIndex(index: number): FloorCell {
    return this._cells[index];
  }

  /**
   * Set a solid, unfading, color for all cells.
   * 
   * @param {byte[]} color An array of colors.
   */
  setColor(color:[number, number, number]) {
    for (let cell of this._cells) {
      cell.setColor(color);
    };
  }

  /**
   * Fade all cells to a color.
   * 
   * @param {byte[]} color The color to fade to.
   * @param {number} duration The time, in milliseconds, it should take to fade to this color.
   * 
   * @return {Promise} The fade promise of the last cell in the list
   */
  fadeToColor(color: [number, number, number], duration: number) {
    let fadePromise;
    for (let cell of this._cells) {
      fadePromise = cell.fadeToColor(color, duration);
    }
    return fadePromise;
  }
  
  /**
   * If the fading color for all cells.
   */
  updateColor(): void {
    for (let cell of this._cells) {
      cell.updateColor();
    }
  }
  
  /**
   * This stops the fade without firing the fade promise.
   * This is used to force stop a program, where the promise might lead to another action.
   */
  clearFadePromises(): void {
    for (let cell of this._cells) {
      cell.clearFadePromise();
    }
  }
}