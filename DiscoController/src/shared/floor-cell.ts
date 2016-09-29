
import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';

import { FadeController } from './fade-controller';

/**
 * Represents a single square on the floor.
 */
export class FloorCell {
  private _color: number[] = [0,0,0];
  private _sensorValue: boolean = false;
  private _fadeCtrl: FadeController;
  private _changeSubject: Subject<IFloorCellChange> = new Subject<IFloorCellChange>();

  /**
   * The index this cell is at in the bus.
   * NOTE: This is not the x/y position
   * @type int
   */
  index: number;

  /**
   * The cell's X coordinate on the dance floor grid
   * @type int
   */
  x: number;

  /**
   * The cell's Y coordinate on the dance floor grid
   * @type int
   */
  y: number;

  /**
   * Subscribe to observe when the color or sensor value of this cell changes.
   * @type Observable
   */
  change$: Observable<IFloorCellChange> = this._changeSubject.asObservable();

  constructor(index: number = undefined, x: number = undefined, y: number = undefined) {
    this.index = index;
    this.x = x;
    this.y = y;
    this._fadeCtrl = new FadeController(this);
  }

  /**
   * Get the cell color
   */
  get color(): number[] {
    return this._color.slice(0, 3); // return a copy
  }

  /**
   * Touch sensor boolean value. True = cell being touched
   * @type boolean
   */
  get sensorValue(): boolean {
    return this._sensorValue;
  }

  /**
   * Set the touch sensor boolean value
   */
  set sensorValue(value:boolean) {
    this._sensorValue = value;
    this._changeSubject.next({
      type: 'sensor',
      value: value
    });
  }

  /**
   * Is this cell currently fading.
   */
  get isFading(): boolean {
    return this._fadeCtrl.isFading;
  }

  /**
   * Set this cell to a specific RGB color.
   * @param {byte[]} color An array of colors.
   * @param {boolean} stopFade Optional, default = true
   *                           This will stop the current fade and go straight to the color.
   *                           Otherwise, the fade will the fade from this new color to the
   *                           existing target fade color.
  */
  setColor(color: number[], stopFade: boolean = true) {
    color = color.slice(0, 3);

    // Currently fading
    if (this._fadeCtrl.isFading) {
      this._fadeCtrl.targetColor = color;
      
      if (stopFade) {
        this._fadeCtrl.stopFade();
      }
      else {
        this._fadeCtrl.targetColor = color;
      }
    }

    this._color = color;

    this._changeSubject.next({
      type: 'color',
      value: color
    });
  }

  /**
   * Start fading to a specific target color.
   * 
   * @param {byte[]} toColor The color to fade to.
   * @param {number} duration The time, in milliseconds, it should take to fade to this color.
   * 
   * @return {Promise} Promise that resolves when the fade is complete
   */
  fadeToColor(toColor: number[], duration: number): Promise<FloorCell> {
    let promise = this._fadeCtrl.startFade(this._color.slice(0,3), toColor, duration);
    return promise;
  }
  
  /**
   * If the cell is fading, update the color for the current time.
   */
  updateColor(): void {
    if (this._fadeCtrl.isFading) {
      this._color = this._fadeCtrl.currentColor;

      this._changeSubject.next({
        type: 'color',
        value: this._color
      });
    }
  }
  
  /**
   * This stops the fade without firing the fade promise.
   * This is used to force stop a program, where the promise might lead to another action.
   */
  clearFadePromise(): void {
    if (this._fadeCtrl.isFading) {
      this._fadeCtrl.clearFadePromise();
    }
  }
}

/**
 * Describes the observable change to a floor cell
 */
export interface IFloorCellChange {
  /**
   * What type of change occurred: color or sensor
   * @type String
   */
  type: "color" | "sensor";

  /**
   * What is the new value for this type of change. 
   * @type boolean | number[]
   */
  value: any;
}