'use strict';

var disco       = require('./lib/disco_controller.js'),
    programCtrl = require('./lib/program_controller.js'),
    comm        = require('./lib/comm.js'),
    audio       = require('./lib/audio.js'),
    serialPort  = require('serialport');

var controller = disco.controller,
    programFilter = {},
    audioLoaded;

// Focus the main window
window.focus();

/*
  Init the page
*/
$(document).ready(function(){
  audioLoaded = audio.init(navigator, MediaStreamTrack);
  serialSetup();
  commSetup();
  buildProgramList();
  startupConfig();

  // Run program when selected
  $('#program-list').change(function(){
    var list = this,
        file = list.options[list.selectedIndex].value;

    if (file === '') {
      programCtrl.runAllPrograms(programFilter);
    } else {
      programCtrl.runProgram(file);
    }
    this.selectedIndex = -1;
  });

  // Update filters
  $('.filters input').change(function(){
    programFilter = {};

    $('.filters input:checked').each(function(){
      programFilter[this.value] = true;
    });

    programCtrl.playAllFilters = programFilter;
    buildProgramList();

    // We're currently in All Play, start over
    if (programCtrl.playAll) {
      programCtrl.runAllPrograms(programFilter);
    }
  });

  // Show the program being played
  programCtrl.events.on('started', function(file, info) {
    var progItem = $('#prog-'+ file.replace('.', '_'));

    if (info.interactive) {
      $('#preview').addClass('interactive');
    } else {
      $('#preview').removeClass('interactive');
    }

    if (progItem.length) {
      $('#program-list').find('.selected').removeClass('selected');
      progItem.addClass('selected');
      $('#stop').attr('disabled', false);
    }
  });

  // Program was shut down
  programCtrl.events.on('shutdown', function() {
    $('#program-list').find('.selected').removeClass('selected');
    $('#stop').attr('disabled', true);
  });

  // Stop program
  $('#stop').click(function(){
    $('#program-list option:selected').removeAttr('selected');
    programCtrl.stopProgram();
  });
});

/**
  Build the list of programs
*/
function buildProgramList() {
  var filters = programCtrl.playAllFilters;

  $('#reset-addresses').get(0).checked = (localStorage.uiResetChecked === true);

  // Load program list
  programCtrl.getProgramList(programFilter)
  .then(function(programs){
    var list = $('#program-list');

    list.find(':not(:first-child)').remove();
    programs.forEach(function(program){
      var item = document.createElement('option');

      item.id = 'prog-'+ program.file.replace('.', '_');
      item.value = program.file;
      item.text = program.info.name;
      item.title = program.info.description || '';

      list.append(item);
    });
  });

  // Update filter selections
  $('.filters input').each(function(){
    var filter = this.value;
    programFilter[filter] = (filters[filter] === true);
  });
}

/**
  Build floor from the user entered dimensions
*/
function buildFromUserDimensions() {
  var x = parseInt($('#floor-max-x').val() ),
      y = parseInt($('#floor-max-y').val() );

  if (!isNaN(x) && !isNaN(y)) {
    controller.removeCells();
    controller.setDimensions(x, y);
  }
}

/**
  Connect to the serial port and all the nodes

  @param {String} port The name/path of the serial port
  @param {boolean} reAddress If we should readdress all the nodes on the floor
  @param {int} nodeCount The number of nodes to expect
*/
function connect(port, reAddress, nodeCount) {
  return new Promise(function(resolve){
    // Setup controller
    controller.emulatedFloor = false;
    controller.removeCells();
    controller.setDimensions(0, 0);

    // Connect
    $('#serial-setup').addClass('connect');
    comm.start(port, reAddress, nodeCount);
    comm.once('done-addressing', function(){
      resolve();
    });

    // Finish
    localStorage.port = port;
    $(document).trigger('emulated-floor', [false]);
  });
}

/**
  Disconnect and show the connection modal again
*/
function disconnect() {
  var modal = $('#serial-setup');

  if (!controller.emulatedFloor) {
    comm.close();
    controller.removeCells();
    controller.emulatedFloor = true;
  }

  // Reset floor dimensions
  buildFromUserDimensions();

  programCtrl.stopProgram();
  modal.removeClass('connect');
  modal.removeClass('closed');
  $('#preview').removeClass('connected');
}

/**
  Turn on emulation mode
*/
function emulationMode() {
  disconnect();
  buildFromUserDimensions();
  $('#serial-setup').addClass('closed');
  $(document).trigger('emulated-floor', [true]);
}

/**
  The Serial Communication setup dialog
*/
function serialSetup(){
  var lastPortNum = 0;

  // Add serial ports to the list
  function updatePorts(){
    serialPort.list(function (err, ports) {
      var list = $('#serial-ports-list'),
          lastPort = localStorage.port || false;

      if (ports && ports.length != lastPortNum) {
        list.empty();
        lastPortNum = ports.length;
        ports.forEach(function(port) {
          var name = port.comName,
              selected = (name == lastPort) ? 'selected' : '';

          list.append('<option '+ selected +'>'+ name +'</option>');
        });
      }
    });

    // Poll
    setTimeout(updatePorts, 1000);
  }
  updatePorts();

  // Skip serial
  $('#serial-setup button.skip').click(function(){
    emulationMode();
  });

  // Port selected, connect and get node count
  $('#serial-setup button.connect').click(function(){
    var port = $('#serial-ports-list').val(),
        reAddress = $('#reset-addresses').is(':checked');
    connect(port, reAddress, parseInt(localStorage.nodeCount));
  });

  // Cancel connection
  $('.connecting .cancel button').click(function(){
    disconnect();
  });

  // Disconnect
  $('.status .disconnect').click(function(){
    disconnect();
  });
}

/**
  Setup event listeners on the comm library
*/
function commSetup() {
  var cycles = 0,
      connectStatus = $('#serial-setup p.status'),
      frameRateEl = $('.status .frame-rate .rate');

  // Show status
  comm.on('new-node', function(){
    var foundNodes = controller.getCells().length;
    if (foundNodes == 1) {
      connectStatus.html('Found '+ foundNodes +' floor cell');
    } else {
      connectStatus.html('Found '+ foundNodes +' floor cells');
    }
  });

  // Setup floor
  comm.on('done-addressing', function(nodeCount){
    if (!nodeCount) {
      connectStatus.html('No floor cells were found.');
      return;
    }
    localStorage.nodeCount = nodeCount;
    $('#preview').addClass('connected');
    $('#serial-setup').addClass('closed');
  });

  // Frame rate
  comm.on('floor-updated', function() {
    cycles++;
  });
  setInterval(function() {
    frameRateEl.html(Math.floor(cycles / 2));
    cycles = 0;
  }, 2000);
}

/**
  Handles the startup config JSON passed in with the `-c`
  command line flag
*/
function startupConfig() {
  var config = global.startupConfig;

  if (!config) {
    return;
  }

  function afterConnect() {
    if (config.program_filter) {
      programFilter = config.program_filter;
      programCtrl.playAllFilters = programFilter;
      buildProgramList();
    }

    if (config.play) {
      // wait for audio system to load
      audioLoaded.then(function(){
        if (config.play === '__ALL__') {
          programCtrl.runAllPrograms(programFilter);
        } else {
          programCtrl.runProgram(config.play);
        }
      });
    }
  }

  if (config.connect && config.connect.port) {
    connect(config.connect.port, false, config.connect.nodes)
    .then(function(){
      afterConnect();
    });
  }
  else {
    emulationMode();
    afterConnect();

    if (config.dimensions) {
      controller.removeCells();
      controller.setDimensions(config.dimensions.x, config.dimensions.y);
    }
  }

}