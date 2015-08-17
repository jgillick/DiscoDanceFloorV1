var gui = require('nw.gui'),
    exec = require('child_process').exec,
    comm = require('./lib/comm.js'),
    audio = require('./lib/audio.js');


var win = gui.Window.get(),
    nativeMenuBar = new gui.Menu({ type: 'menubar' });

// console.log('Arguments!', gui.App.argv);

// Add native keyboard shortcuts
try {
  nativeMenuBar.createMacBuiltin('DiscoController');
  win.menu = nativeMenuBar;
} catch (ex) {
  console.log(ex.message);
}

// Disconnect on exit
win.on('close', function(){
  comm.close().then(function(){
    audio.close().then(function(){
      this.close(true);
    }.bind(this));
  }.bind(this));
});

// Compile SASS templates
var sassCompiler = exec('sass -I ./ --update ./scss:./public/stylesheets', function (error, stdout, stderr) {
	// if (stdout !== '') console.log('SASS: ' + stdout);
	if (stderr !== '') console.log('SASS ERROR: ' + stderr);
	if (error !== null) {
		console.log('SASS exec error: ' + error);
	}

	// Reload stylesheets
	$('link[rel=stylesheet]').each(function(){
		this.setAttribute('href', this.href);
	})
});