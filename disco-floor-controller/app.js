

// Compile SASS files
var sys = require('sys'),
	path = require('path'),
	exec = require('child_process').exec;


(function compileSass() {
	
	exec('sass --watch scss:public/stylesheets', function (error, stdout, stderr) {
		sys.print('stdout: ' + stdout);
		sys.print('stderr: ' + stderr);
		if (error !== null) {
			console.log('exec error: ' + error);
		}
	});

})();