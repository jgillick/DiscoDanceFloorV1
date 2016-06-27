import {Injectable} from '@angular/core';
import { Subject } from 'rxjs/Subject';
import * as path from 'path';
import * as _ from 'lodash';

/**
 * Provides a simple key/value local storage system.
 *
 * Usage:
 * ```
 * let store = new StorageService();
 *
 * store.setItem('foo', 'bar');
 * store.getItem('foo'); // returns 'bar'
 *
 * store.setItem('conf', {things: true});
 * store.getItem('conf'); // returns {things: true}
 * ```
 */
@Injectable()
export class StorageService {
  private storageChangeSource = new Subject<{key:String, value:any}>();

  storage:any // node-persist object
  storageChanged$ = this.storageChangeSource.asObservable();

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
  setItem(key, value):void {
    var oldVal = this.storage.getItemSync(key);
    value = _.cloneDeep(value);

    // No change
    if (_.isEqual(oldVal, value)) {
      return;
    }

    this.storage.setItemSync(key, value);
    this.storageChangeSource.next({
      key: key,
      value: value
    });
  }

  /**
   * Get a setting value by name
   * @param  {String} key The name of the setting to retrieve
   * @return {Object} The setting value
   */
  getItem(key): any {
    return _.cloneDeep(this.storage.getItem(key));
  }

  /**
   * Remove an item from the settings
   * @param {String} key The name of the item to remove
   * @return {Promise}
   */
  removeItem(key): Promise<any> {
    return this.storage.removeItem(key);
  }
}
