/**
 * Communicates with the floor as a master node using the Multi-drop 
 * Bus Protocol defined here:
 * https://github.com/jgillick/AVR-Libs/tree/master/MultidropBusProtocol
 * 
 * This class sends messages, processes responses and coordinates dynamic
 * addressing. 
 */

import { SerialConnect } from './serial-connect.service';

const BROADCAST_ADDRESS = 0;
const RESPONSE_TIMEOUT = 10;
const MAX_ADDRESS_CORRECTIONS = 5;

// Commands
const CMD_RESET   = 0xFA;
const CMD_ADDRESS = 0xFB;
const CMD_NULL    = 0xFF;

const CMD_SET_COLOR  = 0x01;
const CMD_GET_SENSOR = 0x02;

// Message flags
const BATCH_MODE   = 0b00000001;
const RESPONSE_MSG = 0b00000010;

export enum BusMasterStatus {
  // OK statuses
  SUCCESS,
  TIMEOUT,

  // Error statuses
  ERROR,
  MAX_TRIES
}

export class BusMaster {

  private _crc:number;
  private _responseTimer:any = null;
  private _promiseResolvers:Function[];

  private _addressCorrections:number = 0;
  private _addressing:boolean = false;

  nodeNum:number = 0;

  constructor(private _serial:SerialConnect) {
    // Disable daisy line
    this._serial.setDaisy(false);

    // Handle new data received on the bus
    this._serial.port.on('data', d => {
      this._handleData(d);
    });
  }

  /**
   * Start a new message
   */
  startMessage(
    command:number,
    length:number,
    options:{
      batchMode?:boolean,
      responseMsg?:boolean,
      destination?:number
    }={}): Promise<BusMasterStatus> {

    let data = [];

    this._crc = 0xFFFF;
    this._promiseResolvers = [];

    let flags = 0;
    if (options.batchMode) {
      flags |= BATCH_MODE;
    }
    if (options.responseMsg) {
      flags |= RESPONSE_MSG;
    }

    if (typeof options.destination === 'undefined') {
      options.destination = BROADCAST_ADDRESS;
    }

    // Header
    data = [
      0xFF,
      0xFF,
      flags,
      command
    ];

    // Length
    if (options.batchMode) {
      data.push(this.nodeNum);
    }
    data.push(length);

    // Send
    this._sendBytes(data);

    // Deferred response promise
    if (options.responseMsg) {
      return new Promise<any>((resolve, reject) => {
        this._promiseResolvers = [resolve, reject];
      });
    }
    
    return Promise.resolve(BusMasterStatus.SUCCESS);
  }

  /**
   * Start dynamically addressing all nodes
   * 
   * @param {number} startFrom (optional) The address to start from.
   * 
   * @return {Promise}
   */
  startAddressing(startFrom:number=0): Promise<BusMasterStatus> {
    this.nodeNum = startFrom;
    this._addressing = true;
    this._addressCorrections = 0;
    this._promiseResolvers = [];
    
    // Start address message
    this.startMessage(CMD_ADDRESS, 2, { batchMode: true, responseMsg: true });

    // Set daisy and send first address, after message header has sent
    this._serial.port.drain(() => {
      this._serial.setDaisy(true);
      this._sendByte(0x00);

      this._startResponseTimer(); // timeout counter
    });

    // Deferred promise
    return new Promise<any>((resolve, reject) => {
      this._promiseResolvers = [resolve, reject];
    });
  }

  /**
   * Finish the message by sending the CRC values.
   * 
   * @param {BusMasterStatus} status (optional) The status to resolve the message promise with.
   */
  endMessage(status:BusMasterStatus=BusMasterStatus.SUCCESS): void {

    if (this._addressing) {
      this._addressing = false;

      // Send 0xFF twice, if not already
      if (this.nodeNum < 255) { 
        this._sendBytes([0xFF, 0xFF]);
      }
      // Send null message to wrap things up
      this.startMessage(CMD_NULL, 0);
      this.endMessage();
    } 
    else {
      let crcBytes = this._convert16bitTo8(this._crc);
      this._sendBytes(crcBytes, false);
    }

    // Resolve message promise
    if (this._promiseResolvers.length) {

      if (status >= BusMasterStatus.ERROR) {
        this._promiseResolvers[1](status); // reject
      } 
      else {
        this._promiseResolvers[0](status); // resolve
      }
      
    }
  }

  /**
   * Handle new data returned from the bus
   * 
   * @param {Buffer} data A buffer of new data from the serial connection
   */
  private _handleData(data:Buffer): void {
    
    // Address responses
    if (this._addressing) {
      let addr = data[data.length-1]; // We only care about the final byte

      // Verify it's 1 larger than the last address
      if (addr == this.nodeNum + 1) {
        this.nodeNum++;
        this._sendByte(this.nodeNum); // confirm address
      }
      // Invalid address
      else {
        this._addressCorrections++;

        // Max tries, end in error
        if (this._addressCorrections > MAX_ADDRESS_CORRECTIONS) {
          this.endMessage(BusMasterStatus.MAX_TRIES);
        }
        // Address correction: send 0x00 followed by last valid address
        else {
          this._sendByte(0x00);
          this._sendByte(this.nodeNum);
        }
      }
    }
  }

  /**
   * Handle a timeout waiting for a response value
   */
  private _handleResponseTimeout(): void {
    console.log('Timeout');
    
    // Addressing timeout 
    if (this._addressing) {
      console.log('Addressing timeout');
      this.endMessage(BusMasterStatus.TIMEOUT);
    }
  }

  /**
   * Start (or restart) the response value timeout counter.
   */
  private _startResponseTimer() {
    this._stopResponseTimer();

    // Start timer once data has sent
    this._serial.port.drain(() => {
      this._responseTimer = setTimeout(() => {
        this._handleResponseTimeout();
      }, RESPONSE_TIMEOUT); 
    });
  }

  /**
   * Stop the response timeout
   */
  private _stopResponseTimer() {
    if (this._responseTimer) {
      clearTimeout(this._responseTimer);
      this._responseTimer = null;
    }
  }

  /**
   * Send a byte to the serial connection and update the CRC value
   * 
   * @param {number} value The byte value to send.
   * @param {boolean} updateCRC Set this to false to not update the CRC with this byte
   */
  private _sendByte(value:number, updateCRC:boolean=true): void {
    this._sendBytes([value], updateCRC);
  }

  /**
   * Send multiple bytes to the serial connection and update the CRC value.
   * 
   * @param {number[]} values The bytes to send.
   * @param {boolean} updateCRC Set this to false to not update the CRC with this byte
   */
  private _sendBytes(values:number[], updateCRC:boolean=true): void {
    let buff = Buffer.from(values);
    this._serial.port.write(buff);

    if (updateCRC) {
      for (let i = 0; i < buff.length; i++) {
        this._crc = this._generateCRC(this._crc, buff.readUInt8(i));
      }
    }
  }

  /**
   * Generate a 16-bit CRC number.
   * 
   * @param {number} crc (optional) Existing CRC
   * @param {number or Array} value The new number, or array of numbers, to add to the CRC.
   * 
   * @return {number} A 16-bit CRC.
   */
  private _generateCRC(crc, value): number {

    // No CRC specified, define it.
    if (arguments.length == 1) {
      value = crc;
      crc = undefined;
    }
    if (crc === undefined || crc === null) {
      crc = 0xFFFF;
    }

    // Add an array of numbers to the CRC
    if (typeof value == 'object') {

      if (!value.length) {
        console.error('Invalid value to generate CRC from.');
        return crc;
      }

      crc = value.reduce( (c, val) => {
        return this._generateCRC(c, val);
      }, crc);
      return crc;
    }

    // Generate CRC
    crc ^= value;
    for (var i = 0; i < 8; ++i) {
      if (crc & 1)
        crc = (crc >> 1) ^ 0xA001;
      else
        crc = (crc >> 1);
    }

    // Wrap into 16-bit word
    if (crc > 0xFFFF) {
      crc = crc % 0xFFFF;
    }

    return crc;
  }

  /**
   * Split a 16-bit number into two 8-bit numbers.
   * 
   * Tip: you can then use `num.toString(16)` to get the hex value.
   * 
   * @param {number} value The 16-bit number to split
   * 
   * @return {Array} An array of two 8-bit numbers.
   */
  private _convert16bitTo8 (value:number): [number, number] {
    return [
        (value >> 8) & 0xFF,
        value & 0xFF,
    ];
  }
}