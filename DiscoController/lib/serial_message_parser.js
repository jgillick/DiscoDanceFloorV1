'use strict';

var events = require('events').EventEmitter,
    util   = require('util');

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
const TYPE_NULL      = 0x00; // Reset node
const TYPE_ACK       = 0x01; // Acknowledge command
const TYPE_NACK      = 0x02; // Unacknowledge command
const TYPE_STREAMING = 0x03; // Set streaming mode
const TYPE_BATCH     = 0x04;
const TYPE_COLOR     = 0x05; // Set color
const TYPE_FADE      = 0x06; // Set fade
const TYPE_STATUS    = 0x07; // Set or Get node status
const TYPE_MODE      = 0x08; // Set or Get node status
const TYPE_RESET     = 0x10; // Reset node
const TYPE_ADDR      = 0xF1; // Announce address

// Message parsing status
const MSG_STATE_IDL  = 0x00; // no data received
const MSG_STATE_SOM  = 0x10; // no data received
const MSG_STATE_HDR  = 0x20; // collecting header
const MSG_STATE_BOD  = 0x30; // message active
const MSG_STATE_CRC  = 0x40; // message CRC
const MSG_STATE_RDY  = 0x50; // message ready
const MSG_STATE_STRM = 0x60; // streaming message
const MSG_STATE_IGN  = 0x80; // ignore message
const MSG_STATE_ABT  = 0x81; // abnormal termination
const MSG_STATE_BOF  = 0x82; // buffer over flow

// When to timeout an incoming message
const STREAMING_TIMEOUT  = 200;

var serialPort;

/**
  @class MessageParser

  @param {EventEmitter} serialEmitter The event emitter from SerialPort
*/
function MessageParser(serialEmitter) {
  this.serialEmitter = serialEmitter;
  this.start(TYPE_NULL);
}

MessageParser.events = new events.EventEmitter();

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
    True if the current finished message was streamed from all nodes
  */
  streamed: false,

  /**
    The current header position that's being parserd
    @private
  */
  _headerPos: 0,

  /**
    The length of the message, as reported in the headers
  */
  _msgLen: 0,

  /**
    The actual length of the message body
  */
  _actualMsgLen: 0,

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

  // Debugging buffers
  _fullBuffer: [],
  _fullBufferChars: [],

  /**
    A timeout is used during streaming to fill in responses
    that are not being returned from the nodes. If a node does
    not respond in time, master automatically fills it in with 0.

    @type {timer}
    @property _streamingTimer
  */
  _streamingTimer: null,

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
    this._msgLen = 0;
    this._actualMsgLen = 0;

    this.streamed = false;

    this._headerPos = 0;
    this._buffer = [];
    this._fullBuffer = [];
    this._fullBufferChars = [];
    this._calculatedCRC = 0xFFFF;
    this.address = undefined;

    if (type) {
      this._actualMsgLen++;
      this._calculatedCRC = this.generateCRC(this._calculatedCRC, type);
    }

    if (destAddress !== undefined) {
      this.setAddress(destAddress);
    }


    this._stopStreamingTimeout();
  },

  /**
    Reset the entire message and clear everything

    @method reset
  */
  reset: function(){
    this.start(TYPE_NULL);
    this._state = MSG_STATE_IDL;
    this._stopStreamingTimeout();
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
    this._calculatedCRC = this.generateCRC(this._calculatedCRC, this.address);
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

    // console.log(' > '+ c);

    // Debug buffers
    // this._fullBuffer.push(c);
    // this._fullBufferChars.push(String.fromCharCode(c));

    // Streaming response
    if (this._state == MSG_STATE_STRM) {
      this._stopStreamingTimeout();

      // We're still sending the initial streaming message, ignore
      if (this.type == TYPE_STREAMING) {
        return this._state;
      }

      this._actualMsgLen++;
      this._buffer.push(c);
      this._calculatedCRC = this.generateCRC(this._calculatedCRC, c);

      // Received all output, end streaming
      if (this._actualMsgLen == this._msgLen) {
        this._finishStreaming();
      }
      // Continue
      else {
        this._startStreamingTimeout();
      }

      return this._state;
    }

    // Message CRC
    else if (this._state == MSG_STATE_CRC) {
      this._messageCRC |= c;

      // Checksums don't match
      if (this._calculatedCRC != this._messageCRC) {
        this._state = MSG_STATE_ABT;
      } else {
        this._state = MSG_STATE_RDY;
        MessageParser.events.emit('message-ready', this);
      }

      return this._state;

      // var b = new Buffer('asdfasdzxvdsfas');
      // b.writeUInt16LE( crc16_update(b.slice(0,-2)) , b.length-2);
      // crc.crc16modbus(b) == 0;
    }

    // Message body
    else if (this._state == MSG_STATE_BOD) {

      // Lengths didn't match up
      if (this._actualMsgLen > this._msgLen) {
        this._state = MSG_STATE_ABT;
      }
      // End of the message, move on to matching CRC
      else if (this._msgLen === this._actualMsgLen) {
        this._messageCRC = (c << 8);
        this._state = MSG_STATE_CRC;
      }
      else {
        this._actualMsgLen++;
        this._buffer.push(c);
        this._calculatedCRC = this.generateCRC(this._calculatedCRC, c);
      }
      return this._state;
    }

    // Header
    if (this._state == MSG_STATE_HDR) {
      this._calculatedCRC = this.generateCRC(this._calculatedCRC, c);
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
        // this._fullBuffer.push(c);
        // this._fullBufferChars.push(String.fromCharCode(c));
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

    checksum = this.generateCRC(checksum, this.addressDestRange[0]);
    checksum = this.generateCRC(checksum, this.addressDestRange[1]);
    checksum = this.generateCRC(checksum, this.srcAddress);
    checksum = this.generateCRC(checksum, this.type);
    for(var i = 0; i < this._buffer.length; i++ ){
      checksum = this.generateCRC(checksum, this._buffer[i]);
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
        this._actualMsgLen++;
        this._state = MSG_STATE_BOD;
       break;
    }

    this._headerPos++;
    return this._state;
  },

  /**
    Tell the nodes to stream responses for a command type

    @method startStreamingResponse
    @param {int} type The type the nodes should be responding to
    @param {int} lastNode The address of the last node that should send a response
  */
  startStreamingResponse: function(type, lastNode) {
    // console.log('Start streaming');

    // Send message to inform the nodes we're about to start streaming
    this.reset();
    this.type = TYPE_STREAMING;
    this.setAddress(BROADCAST_ADDRESS);
    this.write(type);
    this._state = MSG_STATE_STRM;

    this.send().then(function(){
      var header;
      this.reset();

      // Start second message that will receive the streamed results
      this.type = type;
      this.setAddress(BROADCAST_ADDRESS);
      this._state = MSG_STATE_STRM;
      this._msgLen = lastNode + 1;
      this._actualMsgLen = 1;

      header = [MSG_SOM, MSG_SOM, BROADCAST_ADDRESS, this._msgLen, type];

      this._calculatedCRC = 0xFFFF;
      this._calculatedCRC = this.generateCRC(this._calculatedCRC, header.slice(2));
      this.sendRawData(header)
        .then(this._startStreamingTimeout.bind(this));

    }.bind(this));

    // Start filling in empty responses

  },

  /**
    Finish the streaming response message with the checksum and update
    the message status to RDY

    @private
    @method _finishStreaming
  */
  _finishStreaming: function() {
    // console.log('Finish streaming');
    // console.log(this._buffer.join(', '));
    this._stopStreamingTimeout();
    this.streamed = true;
    this.sendRawData([
      (this._calculatedCRC >> 8) & 0xFF,
      this._calculatedCRC & 0xff
    ]);

    this._state = MSG_STATE_RDY;
    MessageParser.events.emit('message-ready', this);
  },

  /**
    Start a timer that will insert a zero if a node does not
    respond in time for the streaming response

    @private
    @method _startStreamingTimeout
  */
  _startStreamingTimeout: function() {
    this._streamingTimer = setTimeout(function(){
      if (this._state != MSG_STATE_STRM) {
        return;
      }

      // We've finished streaming
      if (this._actualMsgLen >= this._msgLen) {
        this._finishStreaming();
        return;
      }

      console.log('Missed response from node '+ this._actualMsgLen);

      this._buffer.push(0);
      this._actualMsgLen++;
      this._calculatedCRC = this.generateCRC(this._calculatedCRC, 0);
      this.sendRawData([0])
        .then(this._startStreamingTimeout.bind(this));
    }.bind(this), STREAMING_TIMEOUT);
  },

  /**
    Stop the current streaming timer

    @private
    @method _startStreamingTimeout
  */
  _stopStreamingTimeout: function() {
    if (this._streamingTimer) {
      clearTimeout(this._streamingTimer);
      this._streamingTimer = null;
    }
  },

  /**
    Send the message over the serial connection.

    @method send
    @return {Promise} Resolves with the number of bytes sent or error
  */
  send: function(){
    return new Promise(function(resolve, reject) {
    try{
      var data = [],
          crc = 0xFFFF;

      if (!serialPort)
        return reject('No serial port defined. See `MessageParser.setSerialPort(<SerialPort>)`');
      if (this.address === undefined)
        return reject('The destination address has not been defined yet. See setAddress(<byte>)');

      // Message data
      data.push(this.address);
      data.push(this._buffer.length + 1);
      data.push(this.type);
      data = data.concat(this._buffer);

      // Calculate CRC
      crc = this.generateCRC(crc, data);
      data.push((crc >> 8) & 0xFF);
      data.push(crc & 0xff);

      // Add start of message
      data.unshift(MSG_SOM);
      data.unshift(MSG_SOM);

      // if (this.type != TYPE_STREAMING) {
        // console.log('SEND: '+ data.join(', '));
      // }

      // Send
      this.sendRawData(data).then(
        function(){
          this.sentAt = new Date();
          resolve.call(this);
        }.bind(this), reject);
    } catch(e) {
      console.log(e);
    }
    }.bind(this));
  },

  /**
    Sends raw data to the serial port.

    @method sendRawData
    @param {Buffer} buffer Buffer or array of data
    @return Promise
  */
  sendRawData: function(buffer) {
    return new Promise(function(resolve, reject) {
      serialPort.write(buffer, function(err, results){
        if (err) {
          reject(err);
        } else {
          serialPort.drain(function(){
            resolve(results);
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
      case TYPE_STREAMING:
        return 'STREAMING';
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
      case MSG_STATE_STRM:
        return 'STRM';
    }
    return 'UNKNOWN';
  },

  /**
    Calculate a 16-bit CRC.
    Initial crc value should be 0xFFFF
    ported from http://www.nongnu.org/avr-libc/user-manual/group__util__crc.html

    @param {int} crc Current CRC number, if set to undefined, it will be created automatically
    @param {int or array} d Value to add to the CRC
  */
  generateCRC: function(crc, d) {

    if (crc === undefined || crc === null) {
      crc = 0xFFFF;
    }

    // CRC an array
    if (typeof d == 'object') {
      if (!d.length) return crc;

      d.forEach(function(val){
        crc = this.generateCRC(crc, val);
      }.bind(this));
      return crc;
    }

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

};

module.exports = MessageParser;

module.exports.MSG_SOM = MSG_SOM;
module.exports.BROADCAST_ADDRESS = BROADCAST_ADDRESS;

module.exports.TYPE_NULL   = TYPE_NULL;
module.exports.TYPE_ACK    = TYPE_ACK;
module.exports.TYPE_NACK   = TYPE_NACK;
module.exports.TYPE_ADDR   = TYPE_ADDR;
module.exports.TYPE_BATCH  = TYPE_BATCH;
module.exports.TYPE_COLOR  = TYPE_COLOR;
module.exports.TYPE_FADE   = TYPE_FADE;
module.exports.TYPE_STATUS = TYPE_STATUS;
module.exports.TYPE_MODE   = TYPE_MODE;
module.exports.TYPE_RESET  = TYPE_RESET;

module.exports.MSG_SOM = MSG_SOM;
