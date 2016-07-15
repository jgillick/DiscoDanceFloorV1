/**
 * A collection of utility functions that
 * make program development easier.
 */


/**
 * Generate a random non-white RGB color.
 * This method will also ensure that at least one
 * color has a value that is greater than 124.
 *
 * OPTIONS:
 *    + max - An object with max values for r, g, b
 *
 * @param {Object} options
 * @return {number[]} The RGB color.
 */
export function randomColor(options?: {
    max?: {r:number, g:number, b:number}
  }): [number, number, number] {

  let color:[number, number, number] = [0, 0, 0],
      maxValue = 125,
      minValue = 0,
      customMaxValues = [];

  if (options && options.max) {
    customMaxValues = [
      options.max.r,
      options.max.g,
      options.max.b
    ]
  }

  // Set 2 of the primary colors to random values
  for (var c = 0; c < 2; c++) {
    let rgbSelect = Math.floor(Math.random() * 3); // Which RGB color to set

    maxValue = (customMaxValues) ? customMaxValues[rgbSelect] : customMaxValues;
    if (minValue >= maxValue) {
      minValue = 0;
    }

    let colorVal = Math.floor(Math.random() * maxValue);

    if (colorVal < minValue) {
      colorVal = minValue;
    }

    color[rgbSelect] = colorVal;
    maxValue =  255;
    minValue = 100;
  }

  return color;
}

/**
 * Generate a random number between min (inclusive) and max (inclusive).
 *
 * @param {number} min The minimum value the number can be
 * @param {number} max The maxiumum value the number can be
 *
 * @return {number} the random number.
 */
export function randomNumber(min:number, max:number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}