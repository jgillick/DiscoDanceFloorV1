

import { FadeController } from './fade-controller';

/**
 * Represents a single square on the floor.
 */
export class FloorCell {
  sensorValue: boolean = false;
  index: number;
  x: number;
  y: number;

  private _color: number[] = [0,0,0];
  private _fadeCtrl: FadeController;

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
