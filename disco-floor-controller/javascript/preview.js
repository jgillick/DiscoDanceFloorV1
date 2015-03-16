'use strict';

var disco 		 = require('./lib/disco_controller.js'),
		comm 			 = require('./lib/comm.js'),
		serialPort = require('serialport');

var controller = disco.controller;

/*
	Init the page
*/
$(document).ready(function(){
	serialSetup();


	// Load program list
	disco.getProgramList()
	.then(function(programs){
		var list = $('#program-list');

		list.empty();
		programs.forEach(function(program){
			var item = document.createElement('option');

			item.value = program.file;
			item.text = program.name;

			list.append(item);
		});
	});

	// Run program when selected
	$('#program-list').change(function(){
		var list = this,
			file = list.options[list.selectedIndex].value;

		disco.runProgram(file);
	});

});

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
			$('#serial-setup').addClass('closed');
			$('.status .dimensions').css('display', 'none');
		});

	});
}