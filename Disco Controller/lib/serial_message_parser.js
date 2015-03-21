'use strict';

/**
	Handles reading and sending serial messages.

	Each message follows the format:
	>{toRange}{from},{type}{body}{checksum}\n

  >          - The start of a message
  {to}       - Two bytes that make up the destination address range the message is going to (inclusive).
               If the message is for one node, that address is both bytes
  {from}     - The address of the node the message is from
  {type}     - The message type (set LED, get sensor value, etc)
  {body}     - The body of the message
  {checksum} - A 1-byte checksum
  \n         - Marks the end of the message

	@param {int} myAddress The address of this node
*/

// var Promise = require('bluebird');

const MASTER_ADDRESS = 1;

// Message format and characters
const MSG_SOM = '>'.charCodeAt(0);	 // Start of message
const MSG_EOM = '\n'.charCodeAt(0);	 // End of message
const MSG_ESC = '\\'.charCodeAt(0);	 // Escape character
const MSG_ALL = 0x00;                // The wildcard address used to target all nodes

// Message types
const TYPE_NULL   = 0x00;
const TYPE_RESET  = 0x10; // Reset node
const TYPE_ACK    = 0x01; // Acknowledge command
const TYPE_ADDR   = 0x02; // Announce address
const TYPE_COLOR  = 0x04; // Set color
const TYPE_FADE   = 0x05; // Set fade
const TYPE_STATUS = 0x06; // Set or Get node status

// Message parsing status
const MSG_STATE_IDL = 0x00;	// no data received
const MSG_STATE_HDR = 0x10;	// collecting header
const MSG_STATE_ACT = 0x20;	// message active
const MSG_STATE_IGN = 0x40;	// ignore message
const MSG_STATE_RDY = 0x80;	// message ready
const MSG_STATE_ABT = 0x81;	// abnormal termination
const MSG_STATE_BOF = 0x82;	// buffer over flow

// When to timeout an incoming message
const RECEIVE_TIMEOUT = 500;

var myAddress,
		serialPort,
		escapeChars = [
			MSG_SOM,
			MSG_EOM,
			MSG_ESC
		];

/**
	@class MessageParser
*/
function MessageParser() {
	this.start(TYPE_NULL);
}

/**
	Set the address that all messages will
	be sent from. This will also enable better
	message filtering, since it knows where incoming
	messages are coming to.

	@method setMyAddress
	@param {byte} addr
*/
MessageParser.setMyAddress = function(addr) {
	myAddress = addr;
};

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
		The address of where the message came from
	*/
	srcAddress: 0,

	/**
		The destination address range, lower and upper
	*/
	addressDestRange: [undefined, undefined],

	/**
		The current header position that's being parserd
		@private
	*/
	_headerPos: 0,

	/**
		The current message parsing state
		@private
	*/
	_state: 0,

	/**
		If the last character was the escape character
		@private
	*/
	_escaped: false,

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
		@param {byte} destLower (option) The destination address for the message, or the lower range of the destination.
		@param {byte} destUpper (option) If sending to a range of nodes, this is the final destination node address
	*/
	start: function(type, destLower, destUpper) {
		this.stopSending();
		this.type = type;

		if (type === undefined || type == TYPE_NULL) {
			this._state = MSG_STATE_IDL;
		} else {
			this._state = MSG_STATE_ACT;
		}

		this.sentAt = 0;

		this.srcAddress = 0;
		this.addressDestRange = [];

		if (destLower !== undefined) {
			this.setDestAddress(destLower, destUpper);
		}

		this._headerPos = 0;
		this._buffer = [];
		this._fullBuffer = [];
		this._fullBufferChars = [];

		this._escaped = false;
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

		@params {int} dest The destination address (or the lower destination in a range)
		@params {int} destUpper (optional) Defines a destination range from dest and destUpper
	*/
	setDestAddress: function(dest, destUpper){
		this._state = MSG_STATE_ACT;
		this.addressDestRange[0] = dest;
		this.addressDestRange[1] = (destUpper !== undefined) ? destUpper : dest;
	},

	/**
		Is this message address to me

		@method addressedToMe
		@return {Boolean}
	*/
	addressedToMe: function(){
		// Wildcard
	  if (this.addressDestRange[0] == MSG_ALL) return true;

	  // We have not set our address
	  if (myAddress === 0) return false;

	  // Match range
	  if (this.addressDestRange[1] == MSG_ALL && this.addressDestRange[0] >= myAddress) return true;
	  if (this.addressDestRange[0] >= myAddress && this.addressDestRange[0] <= myAddress) return true;

	  return false;
	},

	/**
		Is this message address to master

		@method addressedToMaster
		@return {Boolean}
	*/
	addressedToMaster: function(){
		return this.addressDestRange[0] == MASTER_ADDRESS;
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
		Parse an incoming message one byte at a time

		@method parse
		@param {byte} c Another byte to process
		@return {int} The current message parsing state
	*/
	parse: function(c) {
		var receivedChecksum,
				calcedChecksum;

		if (typeof c == 'undefined') return this._state;

		this._fullBuffer.push(c);
		this._fullBufferChars.push(String.fromCharCode(c));

		// String or buffer of data
		if (c.length) {
			for (var i = 0; i < c.length; i++) {
				this.parse(c[i]);
			}
			return this._state;
		}

		// Previous message timed out
	  if (this._receiveTimeout < Date.now()) {
	    this.reset();
	  }

		// Escape characer
		if (this._escaped) {
			this._escaped = false;

			if (this._state == MSG_STATE_ACT) {
			 this._buffer.push(c);
			 return this._state;
			}
			else if (this._state == MSG_STATE_HDR) {
				return this.processHeader(c);
			}
		}

		// Start of message
		else if(c == MSG_SOM) {
			if (this._fullBuffer.length > 1) {

				var debug = this._fullBuffer.slice(0, -1).map(function(b, i){
					b = (~[MSG_SOM, MSG_EOM, MSG_ESC].indexOf(b)) ? this._fullBufferChars[i] : b;
					b = (b == '\n') ? '\\n' : b;
					b = (b == '\\') ? '\\' : b;
					return b;
				}.bind(this));
				console.log('EXISTING BUFFER:', debug.join(' '));
			}

			this.reset();
			this._state = MSG_STATE_HDR;
			this._receiveTimeout = Date.now() + RECEIVE_TIMEOUT;
			this._fullBuffer.push(c);
			this._fullBufferChars.push(String.fromCharCode(c));
		}

		// Aborted or overflow, wait until we see a new message
		else if (this._state >= MSG_STATE_RDY) {
			return this._state;
		}

		// Header
		else if (this._state == MSG_STATE_HDR) {
			return this.processHeader(c);
		}

		// End of message, parse and return
		else if (c == MSG_EOM) {
			if(this._state == MSG_STATE_ACT) {

				// Compare checksum
				receivedChecksum = this._buffer.pop();
				calcedChecksum = this.calculateChecksum();
				if (calcedChecksum == receivedChecksum) {
					this._state = MSG_STATE_RDY;
				} else {
					// Debug
					console.log('CHECKSUMS MISMATCH: ', this.getStateAsString(), receivedChecksum, ' != ', calcedChecksum);
					console.log('Type:', this.getTypeAsString()+',\t',
											'From:', this.normalizeAddress(this.srcAddress) +',\t',
											'To:', this.normalizeAddress(this.addressDestRange[0]),
											'-', this.normalizeAddress(this.addressDestRange[0]));

					console.log(this._fullBuffer.join('\t'));
					console.log(this._fullBufferChars.join('\t'));

					this._state = MSG_STATE_ABT;
				}
			} else {
				this.reset();
			}
		}

		// Message body
		else if(this._state == MSG_STATE_ACT) {
			if (c == MSG_ESC) {
				 this._escaped = true;
			} else {
				this._buffer.push(c);
			}
		}

		return this._state;
	},

	/**
		Calculate an 8-bit cyclic checksum for the current message

		@return {int} an 8 bit integer checksum
	*/
	calculateChecksum: function() {
		var checksum = 0;
		if (this._state != MSG_STATE_RDY && this._state != MSG_STATE_ACT) return 0;

		checksum = crc_checksum(checksum, this.addressDestRange[0]);
		checksum = crc_checksum(checksum, this.addressDestRange[1]);
		checksum = crc_checksum(checksum, this.srcAddress);
		checksum = crc_checksum(checksum, this.type);
		for(var i = 0; i < this._buffer.length; i++ ){
			checksum = crc_checksum(checksum, this._buffer[i]);
		}

		return checksum;
	},

	/**
		Process the current buffer as the message header

		@params {byte} c One more part of the header
	*/
	processHeader: function(c) {
		if (this._state != MSG_STATE_HDR) return this._state;

	  // Headder parts
	  switch (this._headerPos){

	    // Lower Destination
	    case 0:
	      this.addressDestRange[0] = c;
	    break;
	    // Upper Destination
	    case 1:
	      this.addressDestRange[1] = c;
	    break;
	    // Source address
	    case 2:
	      this.srcAddress = c;
	    break;
	    // Message type
	    case 3:
	      this.type = c;
	    break;

	  }
	  this._headerPos++;

	  // Move onto the body of the message
	  if (this._headerPos >= 4) {
	    this._state = MSG_STATE_ACT;
	  }
	  return this._state;
	},

	/**
		Send the message over the serial connection.

		@method send
		@return {Promise} Resolves with the number of bytes sent or error
	*/
	send: function(){
		var data = [];

		return new Promise(function(resolve, reject) {

			if (!serialPort)
				return reject('No serial port defined. See `MessageParser.setSerialPort(<SerialPort>)`');
			if (myAddress === undefined)
				return reject('The "myAddress" has not been defined yet. See MessageParser.setMyAddress(<byte>)');
			if (this.addressDestRange[0] === undefined || this.addressDestRange[1] === undefined)
				return reject('The destination address has not been defined yet. See setDestAddress(<byte>, [<byte>])');

			this.srcAddress = myAddress;

			// Header
			data.push(this.addressDestRange[0]);
			data.push(this.addressDestRange[1]);
			data.push(myAddress);
			data.push(this.type);

			// Add message body and checksum
			data = data.concat(this._buffer);
			data.push(this.calculateChecksum());

			// Escape reserved characters
			for(var i = data.length - 1; i >= 0; i--) {
				if (~escapeChars.indexOf(data[i])) {
					data.splice(i, 0, MSG_ESC);
				}
			}

			// Wrap message
			data.unshift(MSG_SOM);
			data.push(MSG_EOM);

			// Send
			// console.log('Send', data);
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
			case MSG_STATE_ACT:
				return 'ACT';
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
	}
};

/**
	Create an 8-bit cyclic checksum
	See: http://www.nongnu.org/avr-libc/user-manual/group__util__crc.html#ga37b2f691ebbd917e36e40b096f78d996

	@param {int} crc The current checksum
	@param {int} data The data to add to the checksum;
*/
function crc_checksum(crc, data){
	var i;

	// String
	if (typeof data == 'string') {
		for (i = 0; i < data.length; i++) {
			crc = crc_checksum(crc, data.charCodeAt(i));
		}
	}

	// Array or bytes
	else if (typeof data == 'object' && data.length) {
		for (i = 0; i < data.length; i++) {
			crc = crc_checksum(crc, data[i]);
		}
	}

	// Number
	else if (typeof data == 'number') {
		crc = crc ^ data;
		for (i = 0; i < 8; i++) {
			if (crc & 0x01)
				crc = (crc >> 1) ^ 0x8C;
			else
			crc >>= 1;
		}
	}

	// Wrap into 8-bit byte
	if (crc > 255) {
		crc = crc % 255;
	}
	return crc;
}

module.exports = MessageParser;

module.exports.MASTER_ADDRESS	= MASTER_ADDRESS;
module.exports.MSG_ALL	      = MSG_ALL;

module.exports.TYPE_NULL	 = TYPE_NULL;
module.exports.TYPE_ACK    = TYPE_ACK;
module.exports.TYPE_ADDR   = TYPE_ADDR;
module.exports.TYPE_COLOR  = TYPE_COLOR;
module.exports.TYPE_FADE   = TYPE_FADE;
module.exports.TYPE_STATUS = TYPE_STATUS;

module.exports.MSG_SOM = MSG_SOM;
module.exports.MSG_EOM = MSG_EOM;
module.exports.MSG_ESC = MSG_ESC;
