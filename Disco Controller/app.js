'use strict';

// Compile SASS files
var exec = require('child_process').exec;


(function compileSass() {

	var sassCompiler = exec('sass -I ./ --update ./scss:./public/stylesheets', function (error, stdout, stderr) {
		if (stdout !== '') console.log('SASS: ' + stdout);
		if (stderr !== '') console.log('SASS ERROR: ' + stderr);
		if (error !== null) {
			console.log('SASS exec error: ' + error);
		}

		// TODO: Refresh CSS files in the DOM
	});

})();