'use strict';

/**
 * Main Electron app file.
 * NOT the main Angular app file, confusing, I know.
 */

const electron = require('electron');
const Menu = require('menu');
const path = require('path');
const storage = require('node-persist');

const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.

const BUILD_PATH = path.join(__dirname, '../../build');
const USER_DIR = process.env.HOME || process.env.USERPROFILE;

// Set app root
process.env['DISCO_APP_ROOT'] = path.join(__dirname, '../../');

// Local storage
let storageDir = path.join(USER_DIR, '.disco', 'data');
storage.initSync({ dir: storageDir });

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  app.quit();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  openMainWindow();
});

/**
 * Open the main window
 */
function openMainWindow() {
  var winState = getWindowState({
    width: 800,
    height: 800,
    icon: path.join(BUILD_PATH, 'app/images/app_icon.png')
  });

  // Open window and reset state
  mainWindow = new BrowserWindow(winState);
  if (winState.isMaximized) {
    mainWindow.maximize();
  }
  if (winState.isFullScreen) {
    mainWindow.setFullScreen(true);
  }

  // Starting URL
  mainWindow.loadURL('file://' + BUILD_PATH + '/app/index.html');

  // Open dev tools
  // mainWindow.webContents.openDevTools();

  // Events
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
}

/**
 * Persist the window state for the next session
 */
function saveWindowState(cb) {
  var bounds = mainWindow.getBounds(),
      config = {};

  if (mainWindow.isMaximized() || mainWindow.isFullScreen()) {
    config = {
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen()
    }
  }
  else {
    config = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: false,
      isFullScreen: false
    };
  }
  storage.setItemSync('window', config, cb);
}

/**
 * Get the saved window configuration
 */
function getWindowState(defaultOptions) {
  var saved = storage.getItemSync('window') || {},
      config = Object.assign(defaultOptions, {});

  return Object.assign(config, saved);
}

