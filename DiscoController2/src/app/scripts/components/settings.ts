/**
 * The settings pages.
 */

import { Component } from '@angular/core';
import { StorageService } from '../services/storage.service';

@Component({
  templateUrl: './html/settings.html',
})
export class SettingsComponent{

  settings:any;

  constructor(private _storage:StorageService) {
    this.settings = this._storage.getItem("settings");
  }

  /**
   * Load the settings
   */
  ngOnInit() {
  }

  /**
   * Save settings
   */
  saveForm(evt) {
    this._storage.setItem("settings", this.settings);
  }
}