/**
 * Represents a list of floor cells, with helper methods that let you
 * act on all cells at once.
 *
 * Changing all cells
 * ------------------
 * ```
 *  // Fade all cells on the floor to red in 1 second.
 *  floorCellList.fadeToColor([255, 0, 0], 1000);
 * ```
 *
 * Looping through all the cells with the iterator
 * -----------------------------------------------
 * ```
 * for (let cell of floorCellList) {
 *    console.log(cell.sensorValue);
 * }
 * ```
 *
 * Accessing cells by index
 * ------------------------
 * ```
 *  for (var i = 0; i < floorCellList.length; i++) {
 *    let cell = floorCellList.atIndex(i);
 *    console.log(cell.sensorValue);
 *  }
 * ```
 *
 * Get a cell by X/Y coordinate
 * ----------------------------
 * ```
 *  let x = 5,
 *      y = 10;
 *  let cell = floorCellList.at(x, y);
 * ```
 *
 */

import { FloorCell } from './floor-cell';

export class FloorCellList implements Iterable<FloorCell> {

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
   * Iterator handler that let's us get all the cells in a `for of` statement:
   *
   * for (let cell of floorCellList) {
   *    console.log(cell);
   * }
   *
   */
  [Symbol.iterator]() {
    let pointer = 0;
    let cells = this._cells;

    return {
      next(): IteratorResult<FloorCell> {
        if (pointer < cells.length) {
          return {
            done: false,
            value: cells[pointer++]
          }
        } else {
          return {
            done: true
          }
        }
      }
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
   * Return all the cells that are currently being touched
   */
  getTouched(): FloorCell[] {
    return this._cells.filter( (cell:FloorCell) => cell.sensorValue === true );
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