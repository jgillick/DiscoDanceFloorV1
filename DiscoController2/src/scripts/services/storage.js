import {Injectable} from 'angular2/core';
import * as path from 'path';

/**
 * Provides a simple key/value local storage system.
 */
@Injectable()
export class StorageService {
  constructor() {
    this.storage = require('node-persist');
    this.storage.initSync({ dir: path.join(process.env.INIT_CWD, '.data'), });
    
    // Setup default values
    let settings = this.getItem('settings') || {};
    settings.dimensions = settings.dimensions || { x: 8, y: 8 };
    settings.autoConnect = !!(settings.autoConnect);
    settings.autoPlay = !!(settings.autoPlay);
    this.setItem('settings', settings);
  }

  /**
   * Set a setting value
   * @param {String} name  The name to save the value under
   * @param {Object} value The value to assign to this name (can be any valid JavaScript type)
   */
  setItem(key, value) {
    this.storage.setItemSync(key, value);
  }

  /**
   * Get a setting value by name
   * @param  {String} key The name of the setting to retrieve
   * @return {Object} The setting value
   */
  getItem(key) {
    return this.storage.getItem(key);
  }

  /**
   * Remove an item from the settings
   * @param {String} key The name of the item to remove
   * @return {Promise}
   */
  removeItem(key) {
    return this.storage.removeItem(key);
  }
}