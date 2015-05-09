'use strict';

var Promise = require("bluebird");

var controller,
    floorMap = [],
    colors = [
      [255, 0,   0],   // Red
      [0,   0,   255], // Blue
      [255, 255, 0],   // Yellow
      [255, 0,   255], // Purple
      [0,   255, 0],    // Green
      [255, 140, 0]   // Orange
    ],
    phase = -1,
    phaseNum = 3,
    phaseState, phaseTimer, animateTimer;

module.exports = {

  info: {
      name: 'Saturday Night Fever',
      description: 'Light display similar to the floor from Saturday Night Fever',
      interactive: false,
      miniumumTime: 1
  },

  /**
    Setup the program
  */
  init: function(floorController){
    controller = floorController;
    this.shutdown(); // reset
    mapFloor();
    return Promise.resolve();
  },

  /**
    Shutdown this program and clear memory
  */
  shutdown: function(){
    clearInterval(phaseTimer);
    clearInterval(animateTimer);
    phaseTimer = null;
    animateTimer = null;
    return controller.changeAllCells([0,0,0], 2000);
  },

  /**
    Run the program
  */
  run: function(){
    runPhase();
    // phaseTimer = setInterval(changePhase, phaseTime);
  }
};

/**
  Run the current phase of the floor
*/
function runPhase() {
  switch (phase) {
    case -1:
      lightInward();
      break;
    case 0:
      alternatingRings();
      break;
    case 1:
      runningRings();
      break;
    case 2:
      blinkFloor();
      break;
  }
}

/**
  Move to the next phase
*/
function nextPhase() {
  phase++;
  if (phase >= phaseNum) {
    phase = 0;
  }
  phaseState = null;
  clearTimeout(animateTimer);
  runPhase();
}

/**
  Light the rings from the outside in
*/
function lightInward (){
  var color = 0,
      ring, cell;

  // Determine the state this phase is in
  if (!phaseState) {
    phaseState = {
      ring: 0,
      color: 0
    };
  }

  // Light the current ring
  ring = floorMap[phaseState.ring];
  color = colors[phaseState.color];
  for (var c = 0; c < ring.length; c++) {
    cell = controller.getCell.apply(controller, ring[c]);
    cell.fadeToColor(color, 300);
  }

  // Increment ring and color
  phaseState.ring++;
  phaseState.color++;
  if (phaseState.color >= colors.length) {
    phaseState.color = 0;
  }

  // All done
  if (phaseState.ring >= floorMap.length) {
    setTimeout(nextPhase, 800);
  }
  // Again!
  else {
    animateTimer = setTimeout(lightInward, 400);
  }
}

/**
  Light ever-other ring
*/
function alternatingRings() {
  var colorIndex = 0,
      ring, color, cell;

  if (!phaseState) {
    phaseState = {
      oddEven: 0,
      cycle: 0
    };
    setTimeout(nextPhase, 3000);
  }

  for (var i = 0; i < floorMap.length; i++) {
    ring = floorMap[i];
    colorIndex = (colorIndex + 1 < colors.length) ? ++colorIndex : 0;
    color = colors[colorIndex];

    // Turn off ever other ring
    if (i % 2 != phaseState.oddEven) {
      color = [0, 0, 0];
    }

    for (var c = 0; c < ring.length; c++) {
      cell = controller.getCell.apply(controller, ring[c]);
      cell.fadeToColor(color, 300);
    }
  }

  phaseState.oddEven = (phaseState.oddEven == 1) ? 0 : 1;
  phaseState.cycle++;

  if (phaseState.cycle > 4) {
    setTimeout(nextPhase, 800);
  } else {
    animateTimer = setTimeout(alternatingRings, 800);
  }
}

/**
  Have the rings run outward
*/
function runningRings() {
  var cell, ring, color;

  if (!phaseState) {
    phaseState = {
      color: 0,
      ring: floorMap.length - 1,
      cycle: 0
    };
  }

  // Set ring color
  ring = floorMap[phaseState.ring];
  color = colors[phaseState.color];
  for (var c = 0; c < ring.length; c++) {
    cell = controller.getCell.apply(controller, ring[c]);
    cell.setColor(color);
  }

  phaseState.ring--;
  phaseState.color = (phaseState.color + 1 < colors.length) ? ++phaseState.color : 0;

  // New cycle
  if (phaseState.ring < 0) {
    phaseState.ring = floorMap.length - 1;
    phaseState.cycle++;
    phaseState.color = (phaseState.color + 2 < colors.length) ? phaseState.color + 2 : 0;

    if (phaseState.cycle > 4) {
      setTimeout(nextPhase, 1000);
    }
  }
  animateTimer = setTimeout(runningRings, 300);
}

/**
  Blink entire floor on and off
*/
function blinkFloor() {
  var ring, color, colorIndex, cell, on;

  if (!phaseState) {
    phaseState = {
      cycle: 0
    };
  }

  on = (phaseState.cycle % 2 === 0);
  for (var i = 0; i < floorMap.length; i++) {
    ring = floorMap[i];

    if (on) {
      colorIndex = (colorIndex + 1 < colors.length) ? ++colorIndex : 0;
      color = colors[colorIndex];
    } else {
      color = [0,0,0];
    }

    for (var c = 0; c < ring.length; c++) {
      cell = controller.getCell.apply(controller, ring[c]);
      cell.setColor(color);
    }
  }

  phaseState.cycle++;
  if (phaseState.cycle > 5) {
    setTimeout(nextPhase, 1000);
  } else {
    animateTimer = setTimeout(blinkFloor, 600);
  }
}

/**
  Map the floor to various square rings starting from the outside in
*/
function mapFloor() {
  var dimensions = controller.getDimensions(),
      xMax = dimensions.x,
      yMax = dimensions.y,
      ringNum = 0;

  // Figure out how many rings there are
  ringNum = (dimensions.x > dimensions.y) ? dimensions.y : dimensions.x;
  ringNum = Math.ceil(ringNum / 2);

  xMax--;
  yMax--;

  // Map all rings
  for (var i = 0; i < ringNum; i++) {
    floorMap[i] = [];

    for(var x = i; x <= xMax - i; x++) {
      floorMap[i].push([x, i]);
      floorMap[i].push([x, yMax - i]);
    }
    for(var y = i; y <= yMax - i; y++) {
      floorMap[i].push([i, y]);
      floorMap[i].push([xMax - i, y]);
    }
  }

  console.log(floorMap);
}