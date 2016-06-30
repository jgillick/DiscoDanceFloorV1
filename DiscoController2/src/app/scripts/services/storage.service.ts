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
  setItem(key:string, value:any):void {
    var oldVal = this.getItem(key);
    value = _.cloneDeep(value);

    // No change
    if (_.isEqual(oldVal, value)) {
      return;
    }

    if (key.indexOf('.') < 0) {
      this.storage.setItemSync(key, value);
    } else {
      let keyParts = key.split('.');
      key = keyParts.shift();
      
      let baseObj = this.getItem(key) || {};
      let obj = baseObj;
      
      // Walk down the object dot notation
      while(keyParts.length) {
        let part = keyParts.shift();

        if (typeof obj[part] === 'undefined') {
          obj[part] = {};
        }

        if (keyParts.length) {
          obj = obj[part];
        } else {
          obj[part] = value;
        }
      }
      
      this.storage.setItemSync(key, baseObj);
    }

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
  getItem(key:string): any {
    if (key.indexOf('.') < 0) {
      return _.cloneDeep(this.storage.getItemSync(key));
    } 
    else {
      // Process object notation
      let keyParts = key.split('.');
      let obj = this.getItem(keyParts.shift()) || {};

      return keyParts.reduce( (obj, key) => {
        return obj[key];
      }, obj);
    }
  }

  /**
   * Remove an item from the settings
   * @param {String} key The name of the item to remove
   * @return {Promise}
   */
  removeItem(key:string): Promise<any> {
    return this.storage.removeItem(key);
  }
}
