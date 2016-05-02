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