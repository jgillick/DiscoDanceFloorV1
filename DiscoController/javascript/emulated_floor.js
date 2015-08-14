'use strict';

/* global process */

var disco = require('./lib/disco_controller.js');

var controller = disco.controller;

(function() {
  var fadeProcessing = false;

  $(document).ready(function(){
    var dimensions = controller.getDimensions();

    // Emulated floor
    $(document).on('emulated-floor', function(event, isEmulated) {
      if (isEmulated) {
        emulatedFloorAnimationFrame();
      }
    });

    // Set floor dimensions
    $('#floor-max-x').val(dimensions.x);
    $('#floor-max-y').val(dimensions.y);

    // User updated floor dimensions
    $('.dimensions input').keyup(function(){
      var x = parseInt($('#floor-max-x').val() ),
        y = parseInt($('#floor-max-y').val() );

      if (!isNaN(x) && !isNaN(y)) {
        controller.setDimensions(x, y);
      }
    });

    // Step on/off floor cells
    $('table.grid').mousedown(function(evt){
      if (evt.target.nodeName != 'TD') return;

      var td = $(evt.target),
        x = parseInt(td.attr('data-x')),
        y = parseInt(td.attr('data-y')),
        cell = controller.getCell(x, y);

      cell.setValue(1);
    });
    $('table.grid').mouseup(function(evt){
      if (evt.target.nodeName != 'TD') return;

      var td = $(evt.target),
        x = parseInt(td.attr('data-x')),
        y = parseInt(td.attr('data-y')),
        cell = controller.getCell(x, y);

      cell.setValue(0);
    });


    buildFloor(dimensions.x, dimensions.y);
  });
  window.onresize = sizeTable;

  /**
    Build floor grid
  */
  function buildFloor(xMax, yMax) {
    var emulator = $('.emulator'),
      table = emulator.find('table.grid'),
      tbody = document.createElement('tbody'),
      tr, td;

    table.empty();

    // Create rows and cells
    for (var y = 0; y < yMax; y++) {
      tr = document.createElement('tr');
      for (var x = 0; x < xMax; x++) {
        td = document.createElement('td');
        td.id = 'cell-'+ x +'-'+ y;
        td.setAttribute('data-x', x);
        td.setAttribute('data-y', y);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.append(tbody);
    process.nextTick(sizeTable);
  }

  // Update floor grid
  controller.events.on('dimensions.changed', function(xMax, yMax){
    buildFloor(xMax, yMax);
  });

  // Start stop fade processing
  controller.events.on('fadeFrame.start', function(){
    fadeProcessing = true;
  });
  controller.events.on('fadeFrame.end', function(){
    fadeProcessing = false;
    // window.requestAnimationFrame(updateFrame);
  });

  // Floor cell color changed
  controller.events.on('cell.colorChanged', function emulatorSetColor(x, y, color){
    var el = document.getElementById('cell-'+ x +'-'+ y);
    if (!el) {
      return;
    }

    // Set color
    el.style.background = 'rgb('+ color.join(',') +')';
  });

  /**
    Size the table to keep the floor cells square in the available space
  */
  function sizeTable() {
    var emulator = $('.emulator'),
        table = emulator.find('.grid'),
        dimensions = controller.getDimensions(),
        xMax = dimensions.x,
        yMax = dimensions.y;

    table.css({
      'height': '100%',
      'width': '100%',
    });

    if (xMax < yMax) {
      table.css('width', table.outerHeight());
    }
    else if (xMax > yMax) {
      table.css('height', table.outerWidth());
    }
  }

  // Updates the fading color of all floor cells
  function emulatedFloorAnimationFrame() {
    if (!disco.emulatedFloor) return;

    // If the cell is fading, calling getColor will process the next
    // color increment, which will update the floor via the 'cell.colorChanged' event
    var cells = controller.getCells();
    for (var i = 0, len = cells.length; i < len; i++) {
      cells[i].processFadeIncrement();
    }

    requestAnimationFrame(emulatedFloorAnimationFrame);
  }
})();
