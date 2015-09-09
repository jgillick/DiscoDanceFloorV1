'use strict';

var gui = require('nw.gui'),
    exec = require('child_process').exec,
    comm = require('./lib/comm.js'),
    audio = require('./lib/audio.js'),
    yargs = require('yargs'),
    fs = require('fs');


var win = gui.Window.get(),
    nativeMenuBar = new gui.Menu({ type: 'menubar' });

// Parse arguments
var argv = yargs.usage('DiscoController [options]')
  .option('h', {
        alias: 'help',
        demand: false,
        default: false,
        describe: 'Display this message',
        type: 'boolean'
    })
  .option('c', {
        alias: 'config',
        demand: false,
        default: false,
        describe: 'A JSON config file used to auto-start the floor and programs',
        type: 'string'
    })
  .parse(gui.App.argv);

// Show help
if (argv.help) {
  process.stdout.write(yargs.help() +'\n\n');
  this.close();
}

// Parse config file
if (argv.config !== false) {

  if (argv.config.length == 0) {
    process.stderr.write('ERROR: Invalid config file path\n');
    this.close();
  }
  else {
    try {
      global.startupConfig = JSON.parse(fs.readFileSync(argv.config, 'utf8'));
    } catch(e) {
      process.stderr.write('ERROR: Could not process config file: '+ e.message +'\n');
      this.close();
    }
  }
}

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

  // Force close after a couple seconds
  setTimeout(function(){
    this.close(true);
  }.bind(this), 1000);
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