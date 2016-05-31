import { FloorCell } from './floor-cell';

/**
 * Manages the fading of 3 colors at once.
 */
export class FadeController {
    
  isFading: boolean = false;
  fadePromise: Promise<FloorCell>;
  
  private _duration: number = 0;
  private _targetColor: [number, number, number] = [0, 0, 0];
  private _currentColor: [number, number, number] = [0, 0, 0];
  private _increments: [number, number, number] = [0, 0, 0];
  private _lastFade:number = 0;
  
  private _promiseResolver: Function;
  
  /**
   * @private {FloorCell} _floorCell The floor cell this fade controller is for
   */
  constructor(private _floorCell:FloorCell) {    
  }
  
  /**
   * Get the color that is being faded to. 
   * If we are not currently fading, the cell color will be returned
   * 
   * @return {number[]} An array of the RGB colors. 
   */
  get targetColor(): [number, number, number] {
    if (this.isFading) {
      return this._targetColor;
    }
    return this._floorCell.color;
  }
  
  /**
   * Set the target color that we should fade to.
   * We a fade has not been started, this does nothing.
   * You can use this to change the target color, mid-fade.
   * 
   * @param {number[]} color An array of the RGB colors to fade to.
   */
  set targetColor(color: [number, number, number]) {
    if (this.isFading) {
      this._targetColor = color;
      this.determineFadeIncrements();
    }
  }
  
  /**
   * Get the color at the current fade increment.
   * 
   * @return {number[]} An array of the current RGB color
   */
  get currentColor(): [number, number, number] {
    let now = (new Date()).getTime(),
        diff = now - this._lastFade,
        allIncrements = 0;
    
    // Update the fade if it's been at least 1 millisecond
    if (diff > 1) {
      this._duration -= diff;
      this._lastFade = now;
      
      // Increment all 3 colors
      for (let i = 0; i < 3; i++) {
        this._currentColor[i] += (this._increments[i] * diff);
        
        // Done fading this color
        if ((this._increments[i] > 0 && this._currentColor[i] >= this._targetColor[i])
          || (this._increments[i] < 0 && this._currentColor[i] <= this._targetColor[i])) {
          
          this._currentColor[i] = this._targetColor[i];
          this._increments[i] = 0;
        }
        
        allIncrements += Math.abs(this._increments[i]);
      }
      
      // Done 
      if (this._duration <= 0 || allIncrements === 0) {
        this.stopFade();
      }
    }
    
    return this._currentColor;
  }
  
  /**
   * Begin a new fade
   * 
   * @params {Array} from The color to fade from
   * @params {Array} to The color to fade to
   * @params {number} duration The number of milliseconds the fade should take
   * 
   * @return {Promise} Promise that resolves when the fade is complete
   */
  startFade(from: [number, number, number], to: [number, number, number], duration: number): Promise<FloorCell> {
    this.isFading = true;
    this._duration = duration;
    this._currentColor = from;
    this._targetColor = to;
    this._lastFade = (new Date()).getTime();
    
    // Create a promise proxy
    this.fadePromise = new Promise((resolve, reject) => {
      this._promiseResolver = function(){
        resolve(this._floorCell);
      }
    });
    
    this.determineFadeIncrements();
    
    return this.fadePromise;
  }
  
  /**
   * Stop the current fade
   */
  stopFade(): void {
    this.isFading = false;
    this._currentColor = this._targetColor;
    this._floorCell.setColor(this._targetColor);
    this._promiseResolver();
  }
  
  /**
   * Determine the number of values each color needs to change 
   * every millisecond for the rest of the duration.
   */
  determineFadeIncrements(): void {
    let allIncrements = 0;
    this._increments = [0, 0, 0];
    
    if (this._duration > 0) {
      for (let i = 0; i < 3; i++) {
        let diff = this._targetColor[i] - this._currentColor[i];
        
        if (diff != 0) {
          this._increments[i] = diff / this._duration;
        }
        allIncrements += Math.abs(this._increments[i]);
      }
      
      // If all incrments are zero, we should stop the fade
      if (allIncrements === 0) {
        this.stopFade();
      }
    }
  }
}
