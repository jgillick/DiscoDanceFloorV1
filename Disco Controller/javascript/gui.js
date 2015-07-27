var gui = require('nw.gui');
win = gui.Window.get();
var nativeMenuBar = new gui.Menu({ type: "menubar" });

// Add native keyboard shortcuts
try {
  nativeMenuBar.createMacBuiltin("Disco Controller");
  win.menu = nativeMenuBar;
} catch (ex) {
  console.log(ex.message);
}