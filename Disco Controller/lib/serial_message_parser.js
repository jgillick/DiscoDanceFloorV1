'use strict';

var crc = require('crc');

/**
  Handles reading and sending serial messages.

  Each message follows the format:
  0xFF 0xFF{ID}{len}{type}{data}{checksum}

  0xFF 0xFF  - The start of a message
  {addr}     - The address of the floor node the message is from or to (or 0x00 for broadcast)
  {len}      - The length of the message
  {type}     - The message type (set LED, get sensor value, etc)
  {data}     - The body of the message
  {checksum} - A 1-byte checksum
*/

// var Promise = require('bluebird');

// Start of message
const MSG_SOM = 0xFF;

// Address used to broadcast to all nodes from master
const BROADCAST_ADDRESS = 0x00;

// Message types
const TYPE_NULL   = 0x00; // Reset node
const TYPE_ACK    = 0x01; // Acknowledge command
const TYPE_ADDR   = 0xF1; // Announce address
const TYPE_COLOR  = 0x04; // Set color
const TYPE_FADE   = 0x05; // Set fade
const TYPE_STATUS = 0x06; // Set or Get node status
const TYPE_MODE   = 0x07; // Set or Get node status
const TYPE_RESET  = 0x10; // Reset node

// Message parsing status
const MSG_STATE_IDL = 0x00; // no data received
const MSG_STATE_SOM = 0x10; // no data received
const MSG_STATE_HDR = 0x20; // collecting header
const MSG_STATE_BOD = 0x30; // message active
const MSG_STATE_CRC = 0x40  // message CRC
const MSG_STATE_RDY = 0x50; // message ready
const MSG_STATE_IGN = 0x80; // ignore message
const MSG_STATE_ABT = 0x81; // abnormal termination
const MSG_STATE_BOF = 0x82; // buffer over flow

// When to timeout an incoming message
const RECEIVE_TIMEOUT = 500;

var serialPort;

/**
  @class MessageParser
*/
function MessageParser() {
  this.start(TYPE_NULL);
}

/**
  Set the SerialPort that all communication will
  happen through

  @method setSerialPort
  @param {SerialPort} port
*/
MessageParser.setSerialPort = function(port) {
  serialPort = port;
};

MessageParser.prototype = {

  /**
    The message type
  */
  type: TYPE_NULL,

  /**
    When the message was sent
  */
  sentAt: 0,

  /**
    The address of the node the message came from or is going to
  */
  address: 0,

  /**
    The current header position that's being parserd
    @private
  */
  _headerPos: 0,

  /**
    The length of the message from the header
  */
  _msgLen: 0,

  /**
    The generated CRC
  */
  _calculatedCRC: 0,

  /**
    The 16-bit CRC at the end of the received message
  */
  _messageCRC: 0,

  /**
    The current message parsing state
    @private
  */
  _state: 0,

  /**
    The current message processing buffer
  */
  _buffer: [],

  /**
    Holds the timeout for repeated sends
  */
  _sendTimer: null,

  /**
    When to timeout the current incoming message
  */
  _receiveTimeout: 0,

  // Debugging buffers
  _fullBuffer: [],
  _fullBufferChars: [],

  /**
    Start a fresh message

    @method start
    @param {byte} type The message type (see MessageParser.TYPE_XYZ values)
    @param {byte} destAddress The destination address for the message
  */
  start: function(type, destAddress) {
    this.stopSending();
    this.type = type;
    this._state = MSG_STATE_IDL;

    this.sentAt = 0;

    this._headerPos = 0;
    this._buffer = [];
    this._fullBuffer = [];
    this._fullBufferChars = [];
    this._calculatedCRC = 0xFFFF;

    this.address = undefined;
    if (destAddress !== undefined) {
      this.setAddress(destAddress);
    }
  },

  /**
    Reset the entire message and clear everything

    @method reset
  */
  reset: function(){
    this.start(TYPE_NULL);
  },

  /**
    Is the message complete and ready to be read?
  */
  isReady: function(){
    return this._state == MSG_STATE_RDY;
  },

  /**
    Set the destination address for this message
    @params {int} address
  */
  setAddress: function(address){
    this._state = MSG_STATE_BOD;
    this.address = address;
  },

  /**
    Return the body of the message as an array of bytes

    @method getMessageBody
    @return {Byte Array}
  */
  getMessageBody: function(){
    if (!this.isReady()) return [];
    return this._buffer;
  },

  /**
    Add a character to the message body

    @method write
    @param {byte} c An byte to add to the message
  */
  write: function(c) {
    // String or buffer of data
    if (c.length) {
      for (var i = 0; i < c.length; i++) {
        this.write(c[i]);
      }
      return this._state;
    }

    // Add to buffer
    this._buffer.push(c);
    this._state = MSG_STATE_RDY;
  },

  /**
    Parse an incoming message, one byte at a time

    @method parse
    @param {byte} c Another byte to process
    @return {int} The current message parsing state
  */
  parse: function(c) {

    if (typeof c == 'undefined') return this._state;

    // String or buffer of data
    if (c.length) {
      for (var i = 0; i < c.length; i++) {
        this.parse(c[i]);
      }
      return this._state;
    }

    // Debug buffers
    this._fullBuffer.push(c);
    this._fullBufferChars.push(String.fromCharCode(c));

    // Previous message timed out
    if (this._receiveTimeout < Date.now()) {
      this.reset();
    }

    // Message CRC
    if (this._state == MSG_STATE_CRC) {
      this._messageCRC |= c;

      // Checksums don't match
      if (this._calculatedCRC != this._messageCRC) {
        this._state = MSG_STATE_ABT;
      } else {
        this._state = MSG_STATE_RDY;
      }

      return this._state;

      // var b = new Buffer('asdfasdzxvdsfas');
      // b.writeUInt16LE( crc16_update(b.slice(0,-2)) , b.length-2);
      // crc.crc16modbus(b) == 0;
    }

    // Message body
    else if (this._state == MSG_STATE_BOD) {

      // Lengths didn't match up
      if (this._msgLen < 0) {
        this._state = MSG_STATE_ABT;
      }
      // End of the message, move on to matching CRC
      else if (this._msgLen === 0) {
        this._messageCRC = (c << 8);
        this._state = MSG_STATE_CRC;
      }
      else {
        this._msgLen--;
        this._buffer.push(c);
        this._calculatedCRC = crc16_update(this._calculatedCRC, c);
      }
      return this._state;
    }

    // Header
    if (this._state == MSG_STATE_HDR) {
      this._calculatedCRC = crc16_update(this._calculatedCRC, c);
      return this.processHeader(c);
    }

    // Start of message
    else if(c == MSG_SOM) {

      // This is the second start bit, begin message
      if (this._state === MSG_STATE_SOM) {
        this._state = MSG_STATE_HDR;
      }
      else {
        this.reset();
        this._state = MSG_STATE_SOM;
        this._receiveTimeout = Date.now() + RECEIVE_TIMEOUT;
        this._fullBuffer.push(c);
        this._fullBufferChars.push(String.fromCharCode(c));
      }
      return this._state;
    }

    // Aborted, wait until we see a new message
    else if (this._state >= MSG_STATE_RDY) {
      return this._state;
    }

    return this._state;
  },

  /**
    Calculate an 8-bit cyclic checksum for the current message

    @return {int} an 8 bit integer checksum
  */
  calculateChecksum: function() {
    var checksum = 0;
    if (this._state != MSG_STATE_RDY && this._state != MSG_STATE_BOD) return 0;

    checksum = crc16_update(checksum, this.addressDestRange[0]);
    checksum = crc16_update(checksum, this.addressDestRange[1]);
    checksum = crc16_update(checksum, this.srcAddress);
    checksum = crc16_update(checksum, this.type);
    for(var i = 0; i < this._buffer.length; i++ ){
      checksum = crc16_update(checksum, this._buffer[i]);
    }

    return checksum;
  },

  /**
    Process the current buffer as the message header

    @params {byte} c One more part of the header
  */
  processHeader: function(c) {
    if (this._state != MSG_STATE_HDR) return this._state;

    switch (this._headerPos){

      // Message address
      case 0:
        this.address = c;

        // Not valid address
        if (this.address === 0) {
          this._state = MSG_STATE_ABT;
        }
       break;

       // Message body length
       case 1:
        this._msgLen = c;
       break;

       // Type
       case 2:
        this.type = c;
        this._msgLen--;
        this._state = MSG_STATE_BOD;
       break;
    }

    this._headerPos++;
    return this._state;
  },

  /**
    Send the message over the serial connection.

    @method send
    @return {Promise} Resolves with the number of bytes sent or error
  */
  send: function(){

    return new Promise(function(resolve, reject) {
      var data = [],
          checksum = 0xFFFF;

      if (!serialPort)
        return reject('No serial port defined. See `MessageParser.setSerialPort(<SerialPort>)`');
      if (this.address === undefined)
        return reject('The destination address has not been defined yet. See setAddress(<byte>)');

      // Message data
      data.push(this.address);
      data.push(this._buffer.length + 1);
      data.push(this.type);
      data = data.concat(this._buffer);

      // 16-bit Checksum
      for (var i = 0; i < data.length; i++) {
        checksum = crc16_update(checksum, data[i]);
      }
      data.push((checksum >> 8) & 0xFF);
      data.push(checksum & 0xff);

      // Add start of message
      data.unshift(MSG_SOM);
      data.unshift(MSG_SOM);

      // Send
      serialPort.write(data, function(err, results){
        if (err) {
          reject(err);
        } else {
          serialPort.drain(function(){
            resolve(results);
            this.sentAt = new Date();
          }.bind(this));
        }
      }.bind(this));
    }.bind(this));
  },

  /**
    Wait at least `time` milliseconds before sending the message.
    This can be cancelled with `stopSending()` or `reset()`.

    NOTE: This cannot be used at the same time as `sendEvery()`. One
    will override the other.

    @method sendIn
    @params {int} time The number of milliseconds to wait before sending the message.
    @returns {Promise} For the sent message
  */
  sendIn: function(time){
    this.stopSending();

    return new Promise(function(resolve, reject) {
      this._sendTimer = setTimeout(function(){

        this.send()
        .then(function(){
          resolve.apply(this, arguments);
        })
        .catch(function(){
          reject.apply(this, arguments);
        });

      }.bind(this), time);
    }.bind(this));
  },

  /**
    Calls `send` now and then at regular intervals every
    `time` milliseconds until it's stopped with `stopSending()` or `reset()`.

    NOTE: This cannot be used at the same time as `sendIn()`. One
    will override the other.

    @method sendEvery
    @params {int} time The numbef of milliseconds between sends
    @returns {Promise} for the initial send
  */
  sendEvery: function(time) {
    this.stopSending();

    var sent = this.send();

    // Send again
    sent.then(function(){
      this._sendTimer = setTimeout(function(){
        this.sendEvery(time);
      }.bind(this), time);
    }.bind(this));

    return sent;
  },

  /**
    After using `sendEvery`, this will cancel any future sends.
    @method stopSending
  */
  stopSending: function() {
    clearTimeout(this._sendTimer);
    this._sendTimer = null;
  },

  /**
    Return the message type as a String

    @method getTypeAsString
    @returns {String}
  */
  getTypeAsString: function() {
    switch(this.type) {
      case TYPE_NULL:
        return 'NULL';
      case TYPE_ACK:
        return 'ACK';
      case TYPE_ADDR:
        return 'ADDR';
      case TYPE_COLOR:
        return 'COLOR';
      case TYPE_FADE:
        return 'FADE';
      case TYPE_STATUS:
        return 'STATUS';
    }
    return 'UNKNOWN';
  },

  getStateAsString: function(){
    switch(this._state){
      case MSG_STATE_IDL:
        return 'IDL';
      case MSG_STATE_HDR:
        return 'HDR';
      case MSG_STATE_BOD:
        return 'BOD';
      case MSG_STATE_IGN:
        return 'IGN';
      case MSG_STATE_RDY:
        return 'RDY';
      case MSG_STATE_ABT:
        return 'ABT';
      case MSG_STATE_BOF:
        return 'BOF';
    }
    return 'UNKNOWN';
  },

  /**
    Convert an address byte into either a string or byte.

    + If the address is master, then 'MASTER' will be returned.
    + If the address is the `MSG_ALL` bypte, then '*' will be returned
    + Otherwise, the address byte will be returned.

    @method normalizeAddress
    @param {byte} addr The address to normalize
    @return {String or byte}
  */
  normalizeAddress: function(addr) {
    switch(addr) {
      case MSG_ALL:
        return '*';
      case MASTER_ADDRESS:
        return 'MASTER';
    }
    return addr;
  },

  /**
    Get the full buffer as a normalized string

    @method dumpBuffer
  */
  dumpBuffer: function() {
    var debug = this._fullBuffer.map(function(b, i){
      b = (~[MSG_SOM, MSG_EOM, MSG_ESC].indexOf(b)) ? this._fullBufferChars[i] : b;
      b = (b == '\n') ? '\\n' : b;
      b = (b == '\\') ? '\\' : b;
      return b;
    }.bind(this));

    return debug.join(' ');
  }

};

function crc16_update(crc, d) {
  crc ^= d;
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

module.exports = MessageParser;

module.exports.BROADCAST_ADDRESS = BROADCAST_ADDRESS;

module.exports.TYPE_NULL   = TYPE_NULL;
module.exports.TYPE_ACK    = TYPE_ACK;
module.exports.TYPE_ADDR   = TYPE_ADDR;
module.exports.TYPE_COLOR  = TYPE_COLOR;
module.exports.TYPE_FADE   = TYPE_FADE;
module.exports.TYPE_STATUS = TYPE_STATUS;

module.exports.MSG_SOM = MSG_SOM;
