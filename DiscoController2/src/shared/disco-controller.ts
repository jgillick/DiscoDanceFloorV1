/**
 * Programs will use this service to interact with the floor
 * and it's cells.
 *
 * This also facilitates floor color frames and communicating to the
 * real floor.
 *
 * In short, this pulls all things together into a disco dance party!
 */

import {Injectable} from '@angular/core';

import { FloorCellList } from './floor-cell-list';

@Injectable()
export class DiscoController {
  constructor(public cells: FloorCellList) {
  }
}