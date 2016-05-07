/**
 * The settings pages.
 */

import {Component} from '@angular/core';
import {StorageService} from '../services/storage.service';

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