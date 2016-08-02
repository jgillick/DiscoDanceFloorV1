import { IProgram, Program } from '../shared/program';
import { FloorCellList } from '../shared/floor-cell-list';

@Program({
  name: 'Rain',
  description: 'Rains color down from above',
  interactive: false,
  miniumumTime: 1
})
class Rain implements IProgram {
  floorCellList:FloorCellList;

  /**
   * Start the program
   */
  start(cellList: FloorCellList): Promise<void> {
    this.floorCellList = cellList;
    return Promise.resolve();
  }

  /**
   * Shutdown the program
   */
  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Floor run loop
   */
  loop(time:number): void {
  }
}

module.exports = new Rain();

// var Promise = require("bluebird"),
//     discoUtils = require('../lib/utils.js');

// var floorController = null,
//     running = true,
//     rainSpeed = 80,
//     colorSelect = 0,
//     frequency = 0.9,
//     fadeAmount = 0.10,
//     timeout, columns, colColors,
//     height, colorRainCount,
//     colors = [
//       [0,   255, 0],   // Green
//       [130, 215, 190], // Teal
//       [255, 140, 0],   // Orange
//       [255, 0,   0],   // Red
//       [0,   0,   255], // Blue
//       [255, 255, 0],   // Yellow
//       [255, 0,   255]  // Purple
//     ];

// module.exports = {

//   info: {
//     name: 'Rain',
//     description: 'Rains color down from above',
//     interactive: false,
//     lightShow: true,
//     miniumumTime: 1
//   },

//   /**
//     Setup the program
//   */
//   init: function(controller){
//     var dimensions = controller.getDimensions();

//     floorController = controller;
//     running = true;
//     colorRainCount = 0;
//     columns = new Array(dimensions.x);
//     colColors = new Array(dimensions.x);
//     height = dimensions.y;
//     return Promise.resolve();
//   },

//   /**
//     Shutdown this program and clear memory
//   */
//   shutdown: function(){
//     running = false;
//     clearTimeout(timeout);
//     return floorController.changeAllCells([0,0,0], 500);
//   },

//   /**
//     Run the program
//   */
//   run: function(){
//     rain();
//   }

// };

// /**
//   Manage the rain process for the floor
// */
// function rain() {
//   if (!running) return;

//   fadeDrops();

//   // Make it rain
//   for (var c = 0; c < columns.length; c++) {
//     rainColumn(c);
//   }

//   timeout = setTimeout(rain, rainSpeed);
// }

// /**
//   Fade all existing rain drops
// */
// function fadeDrops() {
//   var cells = floorController.getCells(),
//       cell, color;

//   for (var i = 0, len = cells.length; i < len; i++) {
//     cell = cells[i];
//     color = cell.getColor();
//     for (var n = 0; n < 3; n++) {
//       color[n] -= Math.floor(color[n] * fadeAmount);
//     }
//     cell.fadeToColor(color, 50);
//   }
// }

// /**
//   Manage the leading rain drop down a column
// */
// function rainColumn(col) {
//   var row = columns[col],
//       cell;

//   // Start new a rain drop in a column
//   if (row === undefined || row >= height) {
//     if (Math.random() > frequency) {
//       columns[col] = 0;
//       row = 0;
//       colorRainCount++;
//     }
//   }

//   // New color
//   if (colorRainCount > columns.length) {
//     changeColor();
//   }

//   // Move rain down a column
//   if (row !== undefined && row < height) {
//     cell = floorController.getCell(col, row);
//     if (!cell) return;

//     // New rain
//     if (row === 0) {
//       colColors[col] = colors[colorSelect];
//     }

//     cell.fadeToColor(colColors[col], 50);
//     columns[col]++;
//   }
// }

// /**
//   Change the current rain color
// */
// function changeColor() {
//   colorRainCount = 0;
//   colorSelect = discoUtils.wrap(colorSelect + 1, colors.length -1);
// }
