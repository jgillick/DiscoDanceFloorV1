/**

	The communication interface between the dance floor
	and the RS485 serial bus.

*/

'use strict';

var EventEmitter  = require("events").EventEmitter,
		util   			  = require("util"),
		Serial 			  = require('serialport').SerialPort,
		MessageParser = require('./serial_message_parser.js'),
		disco         = require('./disco_controller.js'),
		FloorCell     = require('./floor_cell.js'),
		discoUtils 		= require('./utils.js'),
		_             = require('underscore');

const BAUD_RATE			      = 250000;
const ACK_TIMEOUT         = 50;
const STATUS_TIMEOUT      = 50;
const ADDRESSING_TIMEOUT  = 1000;

// Program stages
const IDLE                = 0x00;
const ADDRESSING          = 0x01;
const STATUSING           = 0x02;
const UPDATING            = 0x03;

// Status flags
const FADING           		= 0x01;
const SENSOR_DETECT    		= 0x02;

var serialPort,
		txBuffer,
		rxBuffer,
		stage = IDLE,
		statuses = {},
		lastStatusAddr,
		statusTimeout,
		statusTries,
		lastNodeAddr = MessageParser.MASTER_ADDRESS,
		lastUpdate = 0,
		addressingStageTimeout,
		nodeRegistration,
		discoCntrl = disco.controller,
		lastStage = 0,
		stageTimer = 0;


// Set our address on the parser
MessageParser.setMyAddress(MessageParser.MASTER_ADDRESS);


/**
	Handles communication with the floor nodes
	over the serial port

	@inherits EventEmitter
*/
function Comm(){
	EventEmitter.call(this);

	/**
		Start communicating with all the floor cells
		over the serial port

		@param {String} port The serial port to the RS485 bus
		@return SerialPort
	*/
	this.start = function (port){
		nodeRegistration = [];

		serialPort = new Serial(port, {
			baudrate: BAUD_RATE,
			parser: serialParser
		});

		// Open and process incoming data
		serialPort.on('open', function () {
			MessageParser.setSerialPort(serialPort);

			// Listen for new messages
			serialPort.on('message-ready', function(message) {

				// Only message that we have not sent
				if (message.srcAddress != MessageParser.MASTER_ADDRESS) {
					// console.log('Message received: ' + message.getTypeAsString(),
					// 						'From:', message.normalizeAddress(message.srcAddress));
					this.handleMessage(message);
				}

			}.bind(this));

			// Start node address registration
			txBuffer = null;
			this.nextStage();
		}.bind(this));

		return serialPort;
	};

	/**
		Move onto the next stage:

			1. ADDRESSING
			2. STATUSING
			3. UPDATING
			4. Repeat 2 - 4

		@method nextStage
	*/
	this.nextStage = function() {
		var now = Date.now();

		if (txBuffer) {
			txBuffer.reset();
			txBuffer = null;
		}

		// From the old status to the new status
		switch(stage) {
			case IDLE:
				stage = ADDRESSING;
			break;
			case ADDRESSING:
				if (nodeRegistration.length) {
					stage = STATUSING;

					this.emit('done-addressing', nodeRegistration.length);
				}
				// Nothing found, continue
				else {
					this.addressing();
				}
			break;
			case STATUSING:
				stage = UPDATING;
			break;
			case UPDATING:
				stage = STATUSING;
			break;
		}

		// DEBUG - Show how long the last stage took
		// if (lastStage != stage) {
		// 	if (lastStage) {
		// 		console.log(stringForStage(lastStage), ' took', (now - stageTimer) +'ms');
		// 	}
		// 	stageTimer = now;
		// 	lastStage = stage;
		// }

		// Setup and call the new status handler on the next tick of the event loop
		switch(stage) {
			case ADDRESSING:
				process.nextTick(this.addressing.bind(this));
			break;
			case STATUSING:
				// console.log('STATUSING');
				lastStatusAddr = MessageParser.MASTER_ADDRESS;
				process.nextTick(this.status.bind(this));
				// setTimeout(this.status.bind(this), 10);
			break;
			case UPDATING:
				// console.log('UPDATING');
				process.nextTick(this.update.bind(this));
				// setTimeout(this.update.bind(this), 10);
			break;
		}
	};

	/**
		Pass the most recent message to the correct stage.
		For example, all messages received during the addressing stage
		will be sent to the `addressing` method.
	*/
	this.handleMessage = function(message) {
		switch(stage) {
			case ADDRESSING:
				this.addressing(message);
			break;
			case STATUSING:
				this.status(message);
			break;
		}
	};


	/**
		Handle the addressing stage

		@method addressing
		@param {MessageParser} message (optional) The most recent message recieved
	*/
	this.addressing = function(message) {
		var addr;

		// Start sending address requests
		if (!txBuffer) {
			txBuffer = sendAddressingRequest();
			addressingStageTimeout = setTimeout(this.nextStage.bind(this), ADDRESSING_TIMEOUT);
		}

		// Register new address
		else if (message && message.type == MessageParser.TYPE_ADDR) {
			addr = message.getMessageBody()[0];

			// New address must be larger than the last one added
			if (addr > lastNodeAddr) {
				txBuffer.stopSending();

				nodeRegistration.push(addr);
				discoCntrl.addCellWithAddress(addr);
				console.log('Add node at address', addr);

				lastNodeAddr = addr;
				this.emit('new-node', addr);

				// Send ACK, and then query for the next address
				sendACK(addr)
				.then(function(){
					txBuffer = sendAddressingRequest();
				});

				// Update timeout
				clearTimeout(addressingStageTimeout);
				addressingStageTimeout = setTimeout(this.nextStage.bind(this), ADDRESSING_TIMEOUT);
			}
			else {
				console.log('Invalid address:', addr);
			}
		}
	};

	/**
		Handle the status stage

		@method status
		@param {MessageParser} message (optional) The most recent message recieved while in this stage
	*/
	this.status = function(message) {
		var sensor, addr;

		// All statuses received, move on
		if (lastStatusAddr == lastNodeAddr) {
			this.nextStage();
		}

		// Register status
		else if (message && message.type == MessageParser.TYPE_STATUS) {
			sensor = message.getMessageBody()[0] & SENSOR_DETECT;
			addr = message.srcAddress;
			// console.log('Status received from ', addr);

			if (addr > lastStatusAddr) {
				statusTries = 0;
				lastStatusAddr = addr;
				statuses[addr] = message.getMessageBody();
				clearTimeout(statusTimeout);

				// No more nodes
				if (lastStatusAddr >= lastNodeAddr) {
					this.nextStage();
				}
				// Update retry timeout
				else {
					statusTimeout = setTimeout(sendStatusRequest, STATUS_TIMEOUT);
				}
			}
		}

		// Send status request
		else if (!txBuffer) {
			statusTries = 0;
			txBuffer = sendStatusRequest();
		}
	};

	/**
		Handle the node update stage
	*/
	this.update = function() {
		var i = 0,
				batches = [],
				lastMessage;

		nodeRegistration.forEach(function(addr){
			var cell = discoCntrl.getCellByAddress(addr),
					status = statuses[addr],
					message;

			// Could not find cell or status
			if (!cell || !status) {
				return;
			}

			// Process status and sync
			if (!processStatus(addr, cell, status)) {
				message = updateFloorCell(addr, cell, false);

				// If this message is the same as the last, batch it
				if (lastMessage
					&& lastMessage.addressDestRange[1] == addr - 1
					&& lastMessage.type == message.type
					&& _.isEqual(lastMessage.getMessageBody(), message.getMessageBody())) {

					lastMessage.addressDestRange[1] = addr;
				}
				// New message, no batch
				else {
					batches.push(message);
					lastMessage = message;
				}
			}
		});

		// Send message batches
		batches.forEach(function(tx) {
			tx.send();
		});

		this.nextStage();
	};
}
util.inherits(Comm, EventEmitter);
var comm = new Comm();

/**
	Return a string for the STAGE constant

	@function stringForStage
	@param {int} stage
*/
function stringForStage(stage) {
	switch (stage) {
		case ADDRESSING:
			return "ADDRESSING";
		case STATUSING:
			return "STATUSING";
		case UPDATING:
			return "UPDATING";
		default:
			return "UNKNOWN";
	}
}

/**
	A custom SerialPort parser that runs incoming data through the
	MessageParser and emits `message-ready` every time it finds
	an incoming message.

	@function serialParser
	@params {Emitter} emitter The SerialPort event emitter
	@params {Buffer} buffer Incoming data
*/
function serialParser(emitter, buffer) {
	if (!rxBuffer) {
		rxBuffer = new MessageParser();
	}

	for (var i = 0; i < buffer.length; i++){
		rxBuffer.parse(buffer.readUInt8(i));

		if (rxBuffer.isReady()){
			emitter.emit('message-ready', rxBuffer);
			rxBuffer = new MessageParser();
		} else {
			emitter.emit('data', buffer[i]);
		}
	}
}

/**
	Send the last node address to the bus during
	the address registration stage.

	@function sendAddressingRequest
	@return {MessageParser} The sent message object
*/
function sendAddressingRequest() {
	var tx = new MessageParser();

	tx.start(MessageParser.TYPE_ADDR);
	tx.setDestAddress(MessageParser.MSG_ALL);
	tx.write(lastNodeAddr);
	tx.sendEvery(ACK_TIMEOUT);

	return tx;
}

/**
	Send a request for node status

	@function sendStatusRequest
	@return {MessageParser or False} The sent message object or `False` if there are not more nodes
*/
function sendStatusRequest() {
	var tx = new MessageParser();

	// If we've failed to get status at least twice, skip this node
  if (statusTries >= 2) {
    console.log('No status received from '+ (lastStatusAddr + 1));
    lastStatusAddr++;
    statusTries = 0;
  }

  // We're out of nodes
  if (lastStatusAddr >= lastNodeAddr) {
  	comm.nextStage();
    return false;
  }

  tx.start(MessageParser.TYPE_STATUS);
  tx.setDestAddress(lastStatusAddr + 1, MessageParser.MSG_ALL);
  tx.send();
  statusTries++;

  // Automatically attempt again
  statusTimeout = setTimeout(sendStatusRequest, STATUS_TIMEOUT);

  return tx;
}

/**
	Sends the values from FloorCell to the physical cell node

	@private
	@function updateFloorCell
	@param {byte} addr The address of the node to update
	@param {FloorCell} cell The object to get the cell state from
	@param {boolean} noSend (optional) If true, it just sets up the MessageParger, but does not send
	@return MessageParser
*/
function updateFloorCell(addr, cell, noSend) {
	if (disco.emulatedFloor) return Promise.resolve();

	var tx = new MessageParser(),
			type = (cell.isFading()) ? MessageParser.TYPE_FADE : MessageParser.TYPE_COLOR,
			data = cell.getColor();

	if (cell.isFading()) {
		type = MessageParser.TYPE_FADE;
		data = cell.getFadeColor();
		data.push(Math.round(cell.getFadeDuration() / 250));
	}

	tx.start(type);
	tx.setDestAddress(addr);
	tx.write(data);

	if (noSend !== false ) {
		tx.send();
	}
	return tx;
}

/**
	Process the status received from on of the floor
	nodes and sync it with the FloorCell that represents it.

	Here's how it work:
		* The FloorCell is the source of truth for the color & fading state of the node
		* If the node color and the FloorCell color do not match, update the node
		* If the fading status between the node and the Floor cell are different:
		    + If the node's color is the same as the FloorCell's target color, tell the FloorCell the fade is complete
		    + Otherwise, sync the node
    * Update the FloorCell value to match the node's sensor value -- only if it has changed;

	Does the FloorCell object match the status of
	what was returned from the bus

	@private
	@function processStatus
	@param {byte} addr The node address
	@param {FloorCell} cell
	@param {Array of bytes} status
	@return {boolean} True if the node and FloorCell are in sync
*/
function processStatus(addr, cell, status) {
	var hasFadeFlag = (status[0] & FADING),
			sensorDetect = (status[0] & SENSOR_DETECT) ? 1 : 0,
			color = cell.getColor(),
			statusColor = status.slice(1, 4),
			targetColor = (cell.isFading()) ? cell.getFadeColor() : color,
			statusTargetColor = (hasFadeFlag) ? status.slice(4, 7) : statusColor;

	// Set FloorCell value to match sensor value
	if (sensorDetect != cell.getValue()) {
		console.log('Detected change: '+ sensorDetect);
		cell.setValue(sensorDetect ? 1 : 0);
		return false;
	}

	// Stop fading node
	if (hasFadeFlag && !cell.isFading()) {
		console.log('Fading mismatch', cell.isFading(), status[0]);
		return false;
	}

	// Node finished fading, update state
	else if (!hasFadeFlag && cell.isFading() && _.isEqual(statusColor, targetColor)) {
		cell.stopFade();
	}

	// Colors don't match
	else if (!_.isEqual(targetColor, statusTargetColor)) {
		// console.log('Color mismatch', addr, targetColor, statusTargetColor);
		return false;
	}

	// Update color for fade step from the floor
	else if (cell.isFading() && !_.isEqual(color, statusColor)) {
		// console.log('Update FadeCell');
		cell.setColor(statusColor, !hasFadeFlag);
	}

	return true;
}

/**
	Send an ACK message to a node address

	@function sendACK
	@param {byte} addr The destination address
	@return {Promise}
*/
function sendACK(addr) {
	var tx = new MessageParser();
	tx.start(MessageParser.TYPE_ACK);
  tx.setDestAddress(addr);
  return tx.send();
}

module.exports = new Comm();