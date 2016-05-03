'use strict';

module.exports = {
  info: {
    name: 'Random Colors',
    description: 'Fades random colors across the floor.',
    interactive: false,
    lightShow: true,
    miniumumTime: 0.5
  }
};

// var Promise = require("bluebird");

// var floorController = null,
//     running = false;

// module.exports = {

//   info: {
//     name: 'Random Colors',
//     description: 'Fades random colors across the floor.',
//     interactive: false,
//     lightShow: true,
//     miniumumTime: 0.5
//   },

//   /**
//     Setup the program
//   */
//   init: function(controller){
//     running = true;
//     floorController = controller;
//     return Promise.resolve();
//   },

//   /**
//     Shutdown this program and clear memory
//   */
//   shutdown: function(){
//     running = false;
//     return floorController.changeAllCells([0,0,0], 500);
//   },

//   /**
//     Run the program
//   */
//   run: function(){
//     var cells = floorController.getCells();
//     for (var i = 0, len = cells.length; i < len; i++) {
//       this.fadeToColor(cells[i]);
//     }
//   },

//   /**
//     Generate a random color
//   */
//   generateColor: function(){
//     var color,
//         maxValue = 255,
//         random = Math.floor(Math.round() * 4);

//     // If the sum of all three colors is less than 200, it will be too
//     // light to see
//     // do {
//     //  color = [ Math.floor(Math.random() * 128) + 127,
//     //        Math.floor(Math.random() * 128) + 127,
//     //        Math.floor(Math.random() * 128) + 127 ];

//     //  total = color.reduce(function(a, b) { return a + b});
//     // } while(total < 200)


//     // Fade off or on, 1 in 3 times
//     if (Math.floor(Math.round() * 3) === 1) {
//       if (Math.floor(Math.round() * 1) === 0) {
//         color = [0,0,0];
//       } else {
//         color = [255,255,255];
//       }
//     }
//     // Fade two of the RGB colors
//     else {
//       color = [0,0,0];
//       for (var c = 0; c < 2; c++) {
//         var rgbSelect = Math.floor(Math.random() * 3); // Which RGB color to set
//         if (c == 1) maxValue =  125;
//         color[rgbSelect] = Math.floor(Math.random() * maxValue);
//       }
//       // color = [ Math.round(Math.random() * 256),
//       //    Math.round(Math.random() * 256),
//       //    Math.round(Math.random() * 256)
//       //  ];
//     }

//     return color;
//   },

//   /**
//     Have a cell fade to a random color
//   */
//   fadeToColor: function(cell) {
//     if (!running) return;

//     var time = Math.random(Math.random() * 1000) + 1000,
//        color = this.generateColor();

//     // Set fade to and from
//     cell.fadeToColor(color, time)
//       .then(function(){
//         this.fadeToColor(cell);
//       }.bind(this));
//   }

// };