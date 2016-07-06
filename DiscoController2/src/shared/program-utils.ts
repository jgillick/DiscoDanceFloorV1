/**
 * A collection of utility functions that 
 * make program development easier.
 */


/**
 * Generate a random non-white RGB color.
 * This method will also ensure that at least one 
 * color has a value that is greater than 124.
 * 
 * @return {number[]} The RGB color.
 */
export function randomColor(): [number, number, number] {
  let color:[number, number, number] = [0, 0, 0],
      maxValue = 125,
      minValue = 0;

  // Set 2 of the primary colors to random values
  for (var c = 0; c < 2; c++) {
    let rgbSelect = Math.floor(Math.random() * 3); // Which RGB color to set
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