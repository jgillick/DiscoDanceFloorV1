'use strict';

var disco      = require('./lib/disco_controller.js'),
    comm       = require('./lib/comm.js'),
    serialPort = require('serialport'),
    audio      = require('./javascript/audio.js');

var controller = disco.controller,
    programFilter = {};

// Focus the main window
window.focus();

/*
  Init the page
*/
$(document).ready(function(){
  audio.init(navigator, MediaStreamTrack);
  serialSetup();

  buildProgramList();

  // Run program when selected
  $('#program-list').change(function(){
    var list = this,
        file = list.options[list.selectedIndex].value;

    disco.playAll = (file === '');
    disco.runProgram(file);
  });

  // Update filters
  $('#program-filters').change(function(){
    var list = this,
        on = list.options[list.selectedIndex].value;

    programFilter = {};
    if (on !== '') {
      programFilter[on] = true;
    }
    buildProgramList();

    // We're currently in All Play, start over
    if (disco.playAll) {
      disco.playAllFilter = programFilter;
      disco.runProgram('');
    }
  });

  // Show the program being played
  disco.controller.events.on('program.started', function(file) {
    var progItem = $('#prog-'+ file.replace('.', '_'));
    if (progItem.length) {
      $('#program-list').find('.selected').removeClass('selected');
      progItem.addClass('selected');
    }
  });
});

/**
  Build the list of programs
*/
function buildProgramList() {
  // Load program list
  disco.getProgramList(programFilter)
  .then(function(programs){
    var list = $('#program-list');

    list.find(':not(:first-child)').remove();
    programs.forEach(function(program){
      var item = document.createElement('option');

      item.id = 'prog-'+ program.file.replace('.', '_');
      item.value = program.file;
      item.text = program.info.name;

      list.append(item);
    });
  });
}

/**
  The Serial Communication setup dialog
*/
function serialSetup(){
  var lastPortNum = 0;

  // Add serial ports to the list
  function updatePorts(){
    serialPort.list(function (err, ports) {
      var list = $('#serial-ports-list');

      if (ports.length != lastPortNum) {
        lastPortNum = ports.length;

        list.empty();
        ports.forEach(function(port) {
          list.append('<option>'+ port.comName +'</option>');
        });
      }
    });

    // Poll
    setTimeout(updatePorts, 1000);
  }
  updatePorts();

  // Skip serial
  $('#serial-setup button.skip').click(function(){
    $('#serial-setup').addClass('closed');
  });

  // Port selected, connect and get node count
  $('#serial-setup button.connect').click(function(){
    var el = $('#serial-setup'),
        status = el.find('p.status'),
        port = $('#serial-ports-list').val(),
        cycles = 0,
        foundNodes = 0;

    // Connect
    disco.emulatedFloor = false;
    controller.setDimensions(0, 0);
    el.addClass('connect');
    comm.start(port);

    // Show status
    comm.on('new-node', function(){
      foundNodes++;

      if (foundNodes == 1) {
        status.html('Found '+ foundNodes +' floor cell');
      } else {
        status.html('Found '+ foundNodes +' floor cells');
      }
    });

    // Setup floor
    comm.on('done-addressing', function(nodeCount){
      if (!nodeCount) {
        status.html('No floor cells were found.');
        return;
      }
      $('#preview').addClass('connected');
      $('#serial-setup').addClass('closed');
    });

    // Frame rate
    comm.on('stage-change', function(newStage, oldStage) {
      if (oldStage == 'updating') {
        cycles++;
      }
    });
    setInterval(function() {
      var fps = Math.floor(cycles / 2);
      $('.status .frame-rate .rate').html(fps);
      cycles = 0;
    }, 2000);

  });
}