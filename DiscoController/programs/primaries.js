'use strict';

var Promise = require("bluebird"),
    discoUtils = require('../lib/utils.js');

var floorController = null,
    running = true,
    colorSelect = [],
    globalSelect = 0,
    offsState = 0,
    fadeDuration = 500,
    timeout, modeTimeout,
    mode = 'running';

module.exports = {

  info: {
    name: 'Primaries',
    description: 'Fades in primary colors, chasing from one cell to the next',
    interactive: false,
    lightShow: true,
    miniumumTime: 1
  },

  /**
    Setup the program
  */
  init: function(controller){
    running = true;
    floorController = controller;
    return Promise.resolve();
  },

  /**
    Shutdown this program and clear memory
  */
  shutdown: function(){
    running = false;
    clearTimeout(timeout);
    return floorController.changeAllCells([0,0,0], 500);
  },

  /**
    Run the program
  */
  run: function(){
    if (!running) return;

    modeTimeout = setInterval(function(){
      switch(mode) {
        case 'running':
          mode = 'offs';
          break;
        case 'offs':
          mode = 'all';
          break;
        case 'all':
          mode = 'running';
          break;
      }
    }, 6000);

    program();
  }

};

function program() {
  var dimensions = floorController.getDimensions(),
      length = dimensions.x * dimensions.y,
      x = 0, y = 0,
      rgb, color, cell;

  offsState = (offsState) ? 0 : 1;
  globalSelect = discoUtils.wrap(globalSelect + 1, 0, 2);

  for (var i = 0, last = 0; i < length; i++) {
    try {
      color = [0,0,0];
      rgb = colorSelect[i] || last;
      cell = floorController.getCell(x, y);

      if (mode == 'running') {
        rgb = discoUtils.wrap(rgb + 1, 0, 2);
        last = rgb;
        colorSelect[i] = rgb;

        color[rgb] = 255;
      }
      else if (mode == 'offs' && offsState){
        color[rgb] = 255;
      }
      else if (mode == 'all') {
        color[globalSelect] = 255;
      }

      cell.fadeToColor(color, fadeDuration);

      // Increase x/y
      x++;
      if (x >= dimensions.x) {
        x = 0;
        y++;
      }

    } catch(e) {
      console.error(e.message);
      console.error(e.stack);
    }
  }

  timeout = setTimeout(program, fadeDuration * 1.5);
}