/**
 * The settings pages.
 */

import {Component} from 'angular2/core';
import {StorageService} from '../services/storage';

@Component({
  templateUrl: './html/settings.html',
})
export class SettingsComponent{
  
  settings:Object;

  constructor(private _storage:StorageService) {
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
    // get values
    let settings = this._storage.getItem("settings") || {};
  }

  /**
   * Save settings
   */
  saveForm(evt) {
    this._storage.setItem("settings", this.settings);
  }
}