/**
 * Communicates with the floor as a master node using the Multi-drop 
 * Message Bus Protocol defined here:
 * https://github.com/jgillick/AVR-Libs/tree/master/MultidropBusProtocol
 * 
 * This class sends messages, processes responses and coordinates dynamic
 * addressing. 
 */

import { SerialConnect } from './serial-connect.service';

const BROADCAST_ADDRESS = 0;

// Commands
const CMD_RESET   = 0xFA;
const CMD_ADDRESS = 0xFB;
const CMD_NULL    = 0xFF;

const CMD_SET_COLOR  = 0x01;
const CMD_GET_SENSOR = 0x02;

// Message flags
const BATCH_MODE   = 0b00000001;
const RESPONSE_MSG = 0b00000010;

export class BusMaster {

  private _crc:number;
  private _lastAddrReceived:number;
  private _addrPromiseResolvers:Function[];

  nodeNum:number = 0;

  constructor(private _serial:SerialConnect) {
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
    batchMode:boolean=false,
    responseMsg:boolean=false,
    destination:number=BROADCAST_ADDRESS): void {

    this._crc = 0xFFFF;

    let flags = 0;
    if (batchMode) {
      flags |= BATCH_MODE;
    }
    if (responseMsg) {
      flags |= RESPONSE_MSG;
    }

    // Start sending header
    this._sendByte(0xFF);
    this._sendByte(0xFF);
    this._sendByte(flags);
    this._sendByte(destination);
    this._sendByte(command);

    // Length
    if (batchMode) {
      this._sendByte(this.nodeNum);
    }
    this._sendByte(length);
  }

  /**
   * Start dynamically addressing all nodes
   * 
   * @param {number} startFrom (optional) The address to start from.
   * 
   * @return {Promise}
   */
  startAddressing(startFrom:number=0): Promise<void> {
    this.nodeNum = startFrom;
    this._lastAddrReceived = (startFrom) ? startFrom - 1 : 0;
    
    // Start address message
    this.startMessage(CMD_ADDRESS, 2, true, true);

    // First address
    this._serial.setDaisy(true);
    this._sendByte(0x00);

    // Deferred promise
    return new Promise<void>((resolve, reject) => {
      this._addrPromiseResolvers = [resolve, reject];
    });
  }

  /**
   * Finish the message by sending the CRC values 
   */
  endMessage(): void {
    let crcBytes = this._convert16bitTo8(this._crc);
    ;
    this._sendByte(crcBytes[0], false);
    this._sendByte(crcBytes[1], false);
  }

  /**
   * Handle new data returned from the bus
   * 
   * @param {Buffer} data A buffer of new data from the serial connection
   */
  private _handleData(data:Buffer): void {
    
  }

  /**
   * Send a byte to the serial connection and update the CRC value
   * 
   * @param {number} value The byte value to send.
   * @param {boolean} updateCRC Set this to false to not update the CRC with this byte
   */
  private _sendByte(value:number, updateCRC:boolean=true): void {
    let buff = Buffer.from([value]);

    this._crc = this._generateCRC(this._crc, buff.readUInt8(0));
    this._serial.port.write(buff);
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