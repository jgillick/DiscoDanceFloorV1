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

import { Inject, Injectable } from '@angular/core';
import { Observable, Observer } from 'rxjs';

import { FloorCell } from '../../../shared/floor-cell';
import { BusProtocolService, CMD } from './bus-protocol.service';
import { FloorBuilderService } from './floor-builder.service';
import { StorageService } from '../services/storage.service';

const BAUD_RATE       = 250000;
const CMD_LOOP_DELAY  = 1;    // Milliseconds between commands
const SENSOR_DELAY    = 20;   // Delay after the sensor check command (milliseconds)

@Injectable()
export class CommunicationService {

  port: any;
  sensorsEnabled:boolean = true;

  private _fps:number[] = [0, 0, 0, 0];
  private _frames:number = 0;
  private _serialPortLib:any;
  private _running:boolean = false;
  private _runIteration:number = 0;
  private _sensorSelect:number = 1;
  
  bus:BusProtocolService;

  constructor(
    @Inject(FloorBuilderService) private _floorBuilder:FloorBuilderService,
    @Inject(StorageService) private _storage:StorageService) {
    this.bus = new BusProtocolService(this);

    this._floorBuilder.setComm(this);

    // Must be done here, otherwise the UI breaks.
    this._serialPortLib = require('serialport');

    // Close port when window unloads
    window.addEventListener('beforeunload', (e) => {
      if (this.isConnected()) {
        this.port.close();
      }
    });
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
   * Return a list of connected devices that we have connected to
   * in the past. 
   */
  getKnownDevices(): Promise<string[]>{
    return new Promise<string[]> ( (resolve, reject) => {
      this.getDevices()
      .then((devices:string[]) => {
        let knownConnected = [],
            allKnown = this._storage.getItem('connection.knownDevices') || [];

        // Match known devices with connected devices
        allKnown.filter((dev) => devices.indexOf(dev) > -1)
        resolve(allKnown);
      },
      reject);
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
    this._running = false;

    let knownDevices = this._storage.getItem('connection.knownDevices') || [];

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
            // Add to known devices
            knownDevices.unshift(device);
            this._storage.setItem('connection.knownDevices', knownDevices);

            // Return and start bus
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
        console.error('Nothing to close');
        resolve();
        return;
      }

      this._running = false;
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
   *  2. Request nodes check their touch sensors.
   *  3. (short delay)
   *  4. Request sensor data.
   *  5. continue from step 1
   * 
   * @param {boolean} addressing Start the communications by dynamically addressing all floor nodes.
   */
  run(): void {
    if (this._running || this.bus.nodeNum === 0) return;

    this._running = true;
    this._runIteration = 0;
    this._runThread();

    // Frame per second counter
    let fpsCounter = setInterval( () => {
      if (!this._running) {
        clearInterval(fpsCounter);
        return;
      }

      // Shift new FPS onto the stack to get an average
      this._fps.push(this._frames);
      this._fps.shift();
      this._frames = 0;
      
    }, 1000);
  }

  /**
   * Return the number of frames per second we're running at.
   * This is the rate at which we are updating the floor clolors for all cells.
   */
  framesPerSecond():number {
    let sum = this._fps.reduce( (prev, curr) => prev + curr );
    return Math.round(sum / this._fps.length);
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
      let resetTimes = 0;

      // Clear the bus with a null message
      this.bus.startMessage(CMD.NULL, 0);
      this.bus.endMessage().subscribe(null, reset.bind(this), reset.bind(this));

      // Reset node addresses (send twice for good measure)
      function reset() {
        resetTimes++;
        this.bus.startMessage(CMD.RESET, 0);
        this.bus.endMessage().subscribe(
          null,
          (err) => observer.error,
          () => {
            // Reset twice, for good measure
            if (resetTimes < 2) {
              setTimeout(reset.bind(this), 100);
            }
            else {
              setTimeout(addrNodes.bind(this), 500);
            }
          }
        );
      }

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
            // Address one more time, just to catch any slow nodes
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

  /**
   * The run loop thread, that is called continously to communicate with the dance floor.
   * See `run()` for more information.
   */
  private _runThread(): void {
    if (!this._running) return;

    let subject:Observable<any>;
    let nextDelay = CMD_LOOP_DELAY;

    // Run the next interation
    let runNext = function(delay) {
      this._runIteration++;
      setTimeout(this._runThread.bind(this), delay || nextDelay);
    }.bind(this);

    switch (this._runIteration) {
      case 0: // Colors
        subject = this._sendColors();
        break;
      case 1: // Run sensors
        if (!this.sensorsEnabled) return runNext(10);
        subject = this._runSensors();
        nextDelay = SENSOR_DELAY;
        break;
      case 2: // Get sensor data
        if (!this.sensorsEnabled) return runNext(10);
        subject = this._readSensorData();
        break;
      
      // Loop back to the start
      default:
        this._frames++;
        this._runIteration = 0;
        setTimeout(this._runThread.bind(this), 0);
        return;
    };

    // Subscribe to the message
    if (subject) {
      subject.subscribe(
        null,
        // Errors
        (err) => {
          console.error(err);
          runNext();
        },
        // Done
        () => {
          // Handle all responses
          if (this.bus.messageResponse.length) {
            this.bus.messageResponse.forEach( (data, i) => {
              this._handleNodeResponse(i, data);
            });
          }
          runNext();  
        }
      );
    }
  }

  /**
   * Handle a response for a single node
   */
  private _handleNodeResponse(nodeIndex:number, data:number[]): void {
    let node = this._floorBuilder.cellList.atIndex(nodeIndex);
    if (!node) {
      console.error("Response for node at index, ", nodeIndex, ", doesn't exists");
      return;
    }

    switch (this.bus.messageCommand) {
      case CMD.GET_SENSOR_VALUE:
        let val = data[0];

        if (val === 0 || val === 1) { // verify it's a valid value
          node.sensorValue = !!(val);
        } 
      break;
    }
  }

  /**
   * Send RGB colors to all cells
   */
  private _sendColors(): Observable<any> {
    this.bus.startMessage(CMD.SET_COLOR, 3, { batchMode: true });

    for (let cell of this._floorBuilder.cellList) {
      let color = cell.color;
      this.bus.sendData(color);
    }

    return this.bus.endMessage();
  }

  /**
   * Ask all nodes to check their touch sensors.
   */
  private _runSensors(): Observable<any> {
    this.bus.startMessage(CMD.RUN_SENSOR, 1, { batchMode: true });

    // Only ask half the cells checking their sensors at a time
    // this will hopefully prevent as much parasitic capacitance
    let even = (this._sensorSelect > 0);
    for (let i = 0; i < this.bus.nodeNum; i++) {
      let val = (i % 2 == 0 && even) ? 1 : 0;
      this.bus.sendData(val);
    }
    this._sensorSelect *= -1;

    return this.bus.endMessage();
  }

  /**
   * Get the sensor data from all nodes
   */
  private _readSensorData(): Observable<any> {
    return this.bus.startMessage(CMD.GET_SENSOR_VALUE, 1, { 
      batchMode: true, 
      responseMsg: true,
      responseDefault: [0xFF] 
    });
  }
}
