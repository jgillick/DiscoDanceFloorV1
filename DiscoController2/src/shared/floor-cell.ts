
/**
 * Represents a single square on the floor.
 */
export class FloorCell {
  index: number;
  x: number;
  y: number;

  private color: [number, number, number] = [0,0,0];

  // Fade values
  private isFading: boolean = false;
  private fadeDuration: number = 0;
  private targetColor: [number, number, number] = [0,0,0];
  private fadingColor: [number, number, number] = [0,0,0];
  private fadeIncrement: [number, number, number] = [0,0,0];

  constructor(index: number = undefined, x: number = undefined, y: number = undefined) {
    this.index = index;
    this.x = x;
    this.y = y;
  }

  /**
   * Get the cell color
   */
  getColor(): [number, number, number] {
    return this.color;
  }

  /**
   * Set this cell to a specific RGB color.
   * @param {byte[]} color An array of colors.
   * @param {boolean} stopFade Optional, default = true
   *                           This will stop the current fade and go straight to the color.
   *                           Otherwise, the fade will the fade from this new color to the
   *                           existing target fade color.
  */
  setColor(color: [number, number, number], stopFade: boolean = true) {

    // Currently fading
    if (this.isFading) {
      this.targetColor = color;
      if (stopFade) {
        this.stopFade();
      }
      else {
        this._determineFadeIncrement();
      }
    }

    this.color = color;
  }

  /**
   * Start fading to a specific target color.
   * @param {byte[]} color The color to fade to.
   * @param {number} duration The time, in milliseconds, it should take to fade to this color.
   */
  fadeToColor(color: [number, number, number], duration: number) {
    this.isFading = false;
    this.targetColor = color;
    this.fadeDuration = duration;
  }

  /**
   * Stop the current fade and set the color to the target fade color.
   */
  stopFade() {
    this.color = this.targetColor;
    this.isFading = false;
  }

  /**
   * Given the current color, the target color and fade time,
   * figure out how much the color needs to change per millisecond.
   */
  private _determineFadeIncrement() {

  }

}