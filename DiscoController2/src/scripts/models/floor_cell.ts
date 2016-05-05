
/**
 * Represents a single square on the floor.
 */
export class FloorCell {
  index:number;
  x:number;
  y:number;
  
  constructor(index:number = undefined, x:number = undefined, y:number = undefined) {
    this.index = index;
    this.x = x;
    this.y = y;
  }
}