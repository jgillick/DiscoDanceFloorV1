'use strict';

var Serial = require('serialport').SerialPort,
		Buffer = require('buffer'),
		MessageParser = require('./serial_message_parser.js');

const BAUD_RATE			      = 9600;
const ACK_TIMEOUT         = 100;
const STATUS_TIMEOUT      = 500;
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
		statuses = [],
		lastStatusAddr,
		statusTimeout,
		statusTries,
		lastNodeAddr = MessageParser.MASTER_ADDRESS,
		lastUpdate = 0,
		addressingStageTimeout,
		nodeRegistration;


// Set our address on the parser
MessageParser.setMyAddress(MessageParser.MASTER_ADDRESS);
		

/**
	Handles communication with the floor nodes
	over the serial port
*/
var comm = {

	/**
		Start communicating with all the floor cells
		over the serial port

		@param {SerialPort} port The serial port to the RS485 bus
	*/
	start: function (port){
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
	},

	/**
		Move onto the next stage:

			1. ADDRESSING
			2. STATUSING
			3. UPDATING
			4. Repeat 2 - 4

		@method nextStage
	*/
	nextStage: function() {		
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
					console.log('Done addressing. Found', nodeRegistration.length, 'floor cells');
				} 
				// Nothing found, continue
				else {
					console.log('No addresses found, try again');
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

		// Setup and call the new status
		switch(stage) {
			case ADDRESSING: 
				console.log('ADDRESSING');
				this.addressing();
			break;
			case STATUSING: 
				console.log('STATUSING');
				lastStatusAddr = MessageParser.MASTER_ADDRESS;
				this.status();
			break;
			case UPDATING: 
				console.log('UPDATING');
				this.update();
			break;
		}
	},

	/**
		Pass the most recent message to the correct stage. 
		For example, all messages received during the addressing stage
		will be sent to the `addressing` method.
	*/
	handleMessage: function(message) {
		switch(stage) {
			case ADDRESSING:
				this.addressing(message);
			break;
			case STATUSING:
				this.status(message);
			break;
		}
	},


	/**
		Handle the addressing stage

		@method addressing
		@param {MessageParser} message (optional) The most recent message recieved
	*/
	addressing: function(message) {
		var addr;

		// Start sending address requests
		if (!txBuffer) {
			txBuffer = sendAddressingRequest();
			addressingStageTimeout = setTimeout(this.nextStage.bind(this), ADDRESSING_TIMEOUT);
		}

		// Register new address
		else if (message && message.type == MessageParser.TYPE_ADDR) {
			addr = message.getMessageBody()[0];
			if (addr > lastNodeAddr) {
				txBuffer.stopSending();

				// New address must be b{
				console.log('Add node at address', addr);

				nodeRegistration.push(addr);
				lastNodeAddr = addr;
				
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
	},

	/**
		Handle the status stage

		@method status
		@param {MessageParser} message (optional) The most recent message recieved while in this stage
	*/
	status: function(message) {
		var sensor, addr;

		// All statuses received, move on
		if (lastStatusAddr == lastNodeAddr) {
			this.nextStage();
		}

		// Register status
		else if (message && message.type == MessageParser.TYPE_STATUS) {
			sensor = message.getMessageBody()[0] & SENSOR_DETECT;
			addr = message.srcAddress;

			console.log("Got status from ", addr);

			if (addr > lastStatusAddr) {
				statusTries = 0;
				lastStatusAddr = addr;

				// Update retry timeout
				clearTimeout(statusTimeout);
				statusTimeout = setTimeout(sendStatusRequest, STATUS_TIMEOUT);
			}
		}

		// Send status request
		else if (!txBuffer) {
			statusTries = 0;
			txBuffer = sendStatusRequest();
		}
	},

	/**
		Handle the node update stage
	*/
	update: function() {
		console.log('...');

		// Set random color fades every 1.5 seconds
		if (lastUpdate + 1500 < Date.now()) {
			var data = [0,0,0,4], // 8 = 1 second fade (sent as number of 250ms increments)
					maxValue = 120,
					rgbSelect, tx;

			
			// Each node
			nodeRegistration.forEach(function(addr){
				tx = new MessageParser();
				data[0] = 0;
				data[1] = 0;
				data[2] = 0;
				
				// Set a two colors to fade to 
				// (first can go from 0 - 120, secondary can go from 0 - 255)
				for (var c = 0; c < 2; c++) {
					rgbSelect = Math.floor(Math.random() * 3); // Which RGB color to set
					if (c == 1) maxValue =	255;
					data[rgbSelect] = Math.floor(Math.random() * maxValue);
				}

				tx.label = 'Updating';
				tx.start(MessageParser.TYPE_FADE);
				tx.setDestAddress(addr);
				tx.write(data);
				tx.send();
			});

			lastUpdate = Date.now();
		}

		this.nextStage();
	}

};

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
		rxBuffer.write(buffer.readUInt8(i));

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
	@return {MessageParser} The sent message object
*/
function sendStatusRequest() {
	var tx = new MessageParser();

	// If we've failed to get status at least twice, skip this node
  if (statusTries >= 2) {
    console.log('No status received from', lastStatusAddr + 1, 'moving on');
    lastStatusAddr++;
    statusTries = 0;
  }

  // We're out of nodes
  if (lastStatusAddr + 1 >= lastNodeAddr) {
    comm.nextStage();
    return null;
  }

  tx.label = 'Status request';
  tx.start(MessageParser.TYPE_STATUS);
  tx.setDestAddress(lastStatusAddr + 1, MessageParser.MSG_ALL);
  tx.send();
  statusTries++;

  // Automatically attempt again
  statusTimeout = setTimeout(sendStatusRequest, STATUS_TIMEOUT);

  return tx;
}

/**
	Send an ACK message to a node address

	@function sendACK
	@param {byte} addr The destination address
	@return {Promise}
*/
function sendACK(addr) {
	var tx = new MessageParser();
	tx.label = "ACKING";
	tx.start(MessageParser.TYPE_ACK);
  tx.setDestAddress(addr);
  return tx.send();
}


module.exports = comm;
module.exports.port = serialPort;
module.exports.Parser = MessageParser;