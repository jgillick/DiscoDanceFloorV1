/**
 * Used to connect to the DiscoDongle serial
 * interface used to communicate with the dance floor.
 * 
 * Example usage:
 * -------------
 * ```
 * import { SerialConnectService } from './serial-connect.service';
 * 
 * serial = new SerialConnectService();
 * 
 * // Get device list
 * serial.getDevices().then( ... );
 * 
 * // Connect
 * serial.connect('/dev/cu.usbserial-AL028X9K').then( ... );
 * 
 * // Write data
 * serial.port.write(['h', 'i']);
 * 
 * ```
 */

// import { Injectable } from '@angular/core';

const BAUD_RATE = 9600; //250000;

// @Injectable()
export class SerialConnectService {

  port: any;
  serialPortLib:any;

  constructor() {
    // Must be done here, otherwise the UI breaks.
    this.serialPortLib = require('serialport');
  }

  /**
   * Get the list of serial devices connected
   * to the computer
   * 
   * @return {Promise} A promise to an array of device paths
   */
  getDevices(): Promise<string[]> {
    return new Promise<string[]> ( (resolve, reject) => {

      this.serialPortLib.list( (err, ports) => {
        if (err) {
          reject(err);
          return;
        }

        let paths = ports.map( p => {
          return p.comName;
        });
        resolve(paths);
      });
    });
  }

  /**
   * Connect to a serial device.
   * 
   * @param {String} device The path to the device.
   * 
   * @return {Promise}
   */
  connect(device:string): Promise<void> {
    return new Promise<void> ( (resolve, reject) => {

      this.port = new this.serialPortLib.SerialPort(device, {
        baudRate: BAUD_RATE
      }, 
      (err) => { // Connect callback
        if (err){ 
          console.error(err);
          reject(err);
        } else {
          resolve();
        } 
      });
      this.port.on('data', console.log);
      
    });
  }

  /**
   * Disconnect from the serial device.
   * 
   * @return {Promise}
   */
  disconnect(): Promise<void> {
    return new Promise<void> ( (resolve, reject) => {
      if (!this.port || !this.port.isOpen()) {
        reject('There is no open connection');
      }

      this.port.close( err => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve();
        }
      });

    });
  }

  /**
   * Change the status of the outgoing daisy line.
   * 
   * @param {boolean} enabled Set to true to enable the outgoing daisy line.
   */
  setDaisy(enabled): Promise<void> {
    return new Promise<void> ( (resolve, reject) => {
      if (!this.port) {
        reject('There is no open connection');
      }

      this.port.set({rts:enabled, dtr:enabled}, err => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
