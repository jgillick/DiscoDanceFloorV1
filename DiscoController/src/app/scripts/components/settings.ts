/**
 * The settings pages.
 */

import { Component } from '@angular/core';

import { StorageService } from '../services/storage.service';

@Component({
  selector: 'disco-settings',
  templateUrl: './html/settings.html',
  styleUrls: ['./styles/settings.css'],
})
export class SettingsComponent {

  settings:any;

  constructor(private _storage:StorageService) {
    this.settings = this._storage.getItem("settings");
  }

  /**
   * Save settings
   */
  saveForm(evt) {
    this._storage.setItem("settings", this.settings);
  }
}