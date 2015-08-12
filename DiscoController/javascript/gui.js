var gui = require('nw.gui'),
	exec = require('child_process').exec;;


win = gui.Window.get();
var nativeMenuBar = new gui.Menu({ type: "menubar" });

// console.log('Arguments!', gui.App.argv);

// Add native keyboard shortcuts
try {
  nativeMenuBar.createMacBuiltin("Disco Controller");
  win.menu = nativeMenuBar;
} catch (ex) {
  console.log(ex.message);
}

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