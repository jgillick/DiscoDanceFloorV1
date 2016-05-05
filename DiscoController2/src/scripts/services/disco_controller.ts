/**
 * Programs will use this service to interact with the floor
 * and it's cells. 
 * 
 * This also facilitates floor color frames and communicating to the 
 * real floor. 
 * 
 * In short, this pulls all things together into a disco dance party!
 */

import {Injectable} from 'angular2/core';

import { FloorBuilderService } from '../services/floor_builder';

@Injectable()
export class DiscoController {
  constructor(private floor:FloorBuilderService) {
  }
  
  /**
   * Get an array of all floor cells.
   * @return {FloorCell[]}
   */
  get floorCells() {
    return this.floor.cells;
  }
  
  /**
   * Get a floor cell by x/y address.
   */
  getFloorCell(x, y) {
    
  }
  
}