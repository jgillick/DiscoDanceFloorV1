'use strict';

var disco = require('./lib/disco_controller.js'),
	comm = require('./lib/comm.js'),
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

	// Port selected, connect and get node count
	$('#serial-setup .connect').click(function(){
		var port = $('#serial-ports-list').val();
		console.log('Open', port);
		comm.start(port);
	});
}