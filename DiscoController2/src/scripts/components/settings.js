import {Component} from 'angular2/core';

const path = require('path');
const storage = require('node-persist');

@Component({
  templateUrl: './html/settings.html',
})
export class SettingsComponent{
  constructor() {
    this.settings = {
      dimensions: {x: 8, y: 8},
      autoConnect: false,
      autoPlay: false
    };
  }

  /**
   * Load the settings
   */
  ngOnInit() {
    storage.initSync({ dir: path.join(process.env.INIT_CWD, '.data'), });

    // get values
    var settings = storage.getItem("settings");
    this.settings.dimensions = settings.dimensions || { x: 8, y: 8 };
    this.settings.autoConnect = !!(settings.autoConnect);
    this.settings.autoPlay = !!(settings.autoPlay);
  }

  /**
   * Save settings
   */
  saveForm(evt) {
    storage.setItemSync("settings", this.settings);
  }
}