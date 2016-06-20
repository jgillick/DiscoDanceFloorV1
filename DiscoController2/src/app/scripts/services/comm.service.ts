/**
 * Connects to the physical dance floor and facilitates
 * all communication between the floor and the interface.
 */

var serialPort = require("serialport");

export class Communication {

  private _port: any;

  constructor() {

  }

  /**
   * Get the list of serial devices connected
   * to the computer
   * 
   * @return {Promise} A promise to an array of device paths
   */
  getDevices(): Promise<string[]> {
    return new Promise<string[]> ( (resolve, reject) => {

      serialPort.list( (err, ports) => {
        if (err) {
          reject(err);
          return;
        }

        ports.map( p => {
          return p.comName;
        });
        resolve(ports);
      })
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
      this._port = new serialPort.SerialPort(device, {}, (err) => { 
        if (err){ 
          console.error(err);
          reject(err);
        } else {
          resolve();
        } 
      });
    });
  }

  /**
   * Disconnect from the serial device.
   * 
   * @return {Promise}
   */
  disconnect(): Promise<void> {
    return new Promise<void> ( (resolve, reject) => {
      if (!this._port) {
        reject('There is no open connection');
      }

      this._port.close( err => {
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
      if (!this._port) {
        reject('There is no open connection');
      }

      this._port.set({rts:enabled, dtr:enabled}, err => {
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