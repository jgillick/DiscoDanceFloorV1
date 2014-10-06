var disco = require('./lib/disco_controller.js');

var controller = disco.controller;

$(document).ready(function(){
	
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
		})
	});

	// Run program when selected
	$('#program-list').change(function(){
		var list = this,
			file = list.options[list.selectedIndex].value;

		disco.runProgram(file);
	})

})
