'use strict';

var FloorCell = require('../lib/floor_cell.js');

/**
    This floor layout is divided into smaller
    16 cell sections (4x4). The input/output connectors
    for each section are along the top and the cells go
    back and forth along the y-axis.

    Example:
    For a floor made of four 4x4 sections, the cell order would be something
    like this (the arrows represent input/output):

    ```
    >>> 0   7   8   15 >>> 16  23  24  31 >>>,
        1   6   9   14  |  17  22  25  30    ▼
        2   5   10  13  |  18  21  26  29    ▼
        3   4   11  12  |  19  20  27  28    ▼
        -------------------------------      ▼
    <<< 63  56  55  48 <<< 47  40  39  32 <<<'
        62  57  54  49  |  46  41  38  33
        61  58  53  50  |  45  42  37  34
        60  59  52  51  |  44  43  36  35
    ```

  @method fourByFour
  @param {Object} dimensions The max x/y length of the floor
  @param {Array} cells List of FloorCell objects.
                       If a cell is `null` a new one will be initialized in it's place
  @return {Array} Object mapping x/y to cell index
*/
function fourByFour(dimensions, cells, discoController) {

  var x = 0,
      y = 0,
      xDir = 1,
      yDir = 1,
      map = {},
      length = dimensions.x * dimensions.y,
      xFlipped = false,
      yFlipped = false;

  for (var i = 0; i < cells.length; i++) {
    var cell = cells[i];

    if (cell) {
      cell.setXY(x, y);
    } else {
      cells[i] = new FloorCell(x, y, discoController);
    }

    if (!map[x]) {
      map[x] = {};
    }
    map[x][y] = i;

    // Move up and down by 4s
    // If we hit the top or bottom or 4s, switch y direction
    if (!yFlipped && (
        ((y + 1) % 4 === 0 && yDir > 0)  ||
        (y % 4 === 0 && yDir < 0))){
      yDir *= -1;
      x += xDir;
      yFlipped = true;
    } else {
      y += yDir;
      yFlipped = false;
    }

    // End of x-axis
    if (!xFlipped && (x >= dimensions.x || x < 0)) {
      yDir = 1;
      xDir *= -1;
      y += 4;

      if (x >= dimensions.x){
        x = dimensions.x - 1;
      } else {
        x = 0;
      }

      xFlipped = true;
      yFlipped = true;
    } else {
      xFlipped = false;
    }
  }

  return map;
}

module.exports.fourByFour = fourByFour;
module.exports.generateFloor = fourByFour;