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
   * If we are not currently fading, an array filled with -1 will be returned.
   * 
   * @return {number[]} An array of the RGB colors. 
   */
  get targetColor(): [number, number, number] {
    if (this.isFading) {
      return this._targetColor;
    }
    return [-1, -1, -1];
  }
  
  /**
   * Set the target color that we should fade to.
   * We a fade has not been started, this does nothing.
   * You can use this to change the target color, mid-fade.
   * 
   * @param {number[]} color An array of the RGB colors to fade to.
   */
  set targetColor(color: [number, number, number]) {
    // if (this._floorCell.x == 0 && this._floorCell.y == 0) console.log('Set target color', color);
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
        diff = now - this._lastFade;
        
    // if (this._floorCell.x == 0 && this._floorCell.y == 0) console.log('get color');
    
    // Update the fade if it's been at least 1 millisecond
    if (diff > 1) {
      // if (this._floorCell.x == 0 && this._floorCell.y == 0) console.log('update color');
      this._duration -= diff;
      
      // Increment all 3 colors
      for (let i = 0; i < 3; i++) {
        this._currentColor[i] += this._increments[i];
        
        // Done fading this color
        if ((this._increments[i] > 0 && this._currentColor[i] >= this._targetColor[i])
          || (this._increments[i] < 0 && this._currentColor[i] <= this._targetColor[i])) {
          
          this._currentColor[i] = this._targetColor[i];
          this._increments[i] = 0;
        }
      }
      
      // Done 
      if (this._duration <= 0) {
        this.stopFade();
      }
      
      this._lastFade = now;
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
    this.targetColor = to;
    this._lastFade = (new Date()).getTime();
    
    // Create promise and assign a function to resolve it
    this.fadePromise = new Promise((resolve, reject) => {
      this._promiseResolver = function(){
        resolve(this._floorCell);
      }
    });
    return this.fadePromise;
  }
  
  /**
   * Stop the current fade
   */
  stopFade(): void {
    this.isFading = false;
    this._currentColor = this._targetColor;
    this._promiseResolver();
  }
  
  /**
   * Determine the number of values each color needs to change 
   * every millisecond for the rest of the duration.
   */
  determineFadeIncrements(): void {
    this._increments = [0, 0, 0];
    
    if (this._duration > 0) {
      for (let i = 0; i < 3; i++) {
        let diff = this._targetColor[i] - this._currentColor[i];
        
        if (diff != 0) {
          this._increments[i] = diff / this._duration;
        }
      }
    }
    // if (this._floorCell.x == 0 && this._floorCell.y == 0) console.log('Fade increment', this._increments);
  }
}
