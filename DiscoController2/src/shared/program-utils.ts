/**
 * A collection of utility functions that 
 * make program development easier.
 */


/**
 * Generate a random non-white RGB color
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