/**
 * Used to connect to the DiscoDongle serial
 * interface used to communicate with the dance floor.
 * 
 * Example usage:
 * -------------
 * ```
 * import { CommunicationService } from './serial-connect.service';
 * 
 * let comm = new CommunicationServices();
 * 
 * // Get device list
 * comm.getDevices().then( ... );
 * 
 * // Connect
 * comm.connect('/dev/cu.usbserial-AL028X9K').then( ... );
 * 
 * // Write data
 * comm.port.write(['h', 'i']);
 * 
 * ```
 */

import { Injectable } from '@angular/core';
import { Observable, Observer } from 'rxjs';

import { BusProtocolService, CMD } from './bus-protocol.service';

const BAUD_RATE = 9600; //250000;

@Injectable()
export class CommunicationService {

  port: any;

  private _serialPortLib:any;
  
  bus:BusProtocolService;

  constructor() {
    this.bus = new BusProtocolService(this);

    // Must be done here, otherwise the UI breaks.
    this._serialPortLib = require('serialport');
  }

  /**
   * Get the list of serial devices connected
   * to the computer
   * 
   * @return {Promise} A promise to an array of device paths
   */
  getDevices(): Promise<string[]> {
    return new Promise<string[]> ( (resolve, reject) => {

      this._serialPortLib.list( (err, ports) => {
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
   * Are we currently connected to a device
   */
  isConnected(): boolean {
    return (this.port && this.port.isOpen());
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
      
      // Disconnect, if we're currently connected
      if (this.isConnected()) {
        this.disconnect().then(conn);
      }
      else {
        conn.bind(this)();
      }

      function conn() {
        this.port = new this._serialPortLib.SerialPort(device, {
          baudRate: BAUD_RATE
        }, 
        (err) => { // Connect callback
          if (err){ 
            console.error(err);
            reject(err);
          } else {
            resolve();
            this.bus.connect();
          } 
        });
      }
      
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
        resolve();
        return;
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

  /**
   * Run looping communications with the floor.
   *  1. Send floor colors to all nodes.
   *  3. Request nodes check their touch sensors.
   *  4. (short delay)
   *  5. Request sensor data.
   *  6. continue from step 1
   * 
   * @param {boolean} addressing Start the communications by dynamically addressing all floor nodes.
   */
  run(): void {

  }

  /**
   * Dynamically address all floor cells.
   * 
   * This starts by sending a reset message, so all nodes reset their addresses.
   * Then it sends out an addressing message. 
   * After that returns, it does one more addressing message to pickup any nodes that didn't respond the first time around.
   */
  assignAddresses(): Observable<number>{
    let source = Observable.create( (observer:Observer<number>) => {
      let addressTimes = 0;
      let nodeNum = 0;

      // Reset nodes
      this.bus.startMessage(CMD.RESET, 0);
      this.bus.endMessage().subscribe(
        null,
        (err) => observer.error,
        () => {
          setTimeout(addrNodes.bind(this), 500);
        }
      );

      // Address all nodes
      function addrNodes() {
        addressTimes++;

        this.bus.startAddressing(nodeNum)
        .subscribe(
          (n) => observer.next(n),

          // Error
          (err) => {
            console.error(err);

            // Try again
            if (addressTimes === 1) {
              setTimeout(addrNodes.bind(this), 500);
            }
            else {
              observer.error(err)
            }
          },

          // Complete
          () => {
            // See if there are any straglers
            if (addressTimes === 1) {
              nodeNum = this.bus.nodeNum;
              setTimeout(addrNodes.bind(this), 500);
            }
            // All done
            else {
              observer.complete();
            }
          }
        );
      }
    });

    let observable = source.publish();
    observable.connect();
    return observable;
  }
}
