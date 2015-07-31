/**

  The communication interface between the dance floor
  and the RS485 serial bus.

*/

'use strict';

var EventEmitter  = require('events').EventEmitter,
    util          = require('util'),
    Serial        = require('serialport').SerialPort,
    MessageParser = require('./serial_message_parser.js'),
    disco         = require('./disco_controller.js'),
    _             = require('underscore');

const BAUD_RATE           = 500000; // 4800;
const ACK_TIMEOUT         = 50; //1000;
const STATUS_TIMEOUT      = 50; //1000;
const ADDRESSING_TIMEOUT  = 1000;
const NULL_SIGNATURE      = '0,0,0,0';

// Program stages
const IDLE                = 'idle';
const ADDRESSING          = 'addressing';
const STATUSING           = 'statusing';
const UPDATING            = 'updating';

// Status flags
const FADING              = 0b00100000;
const SENSOR_DETECT       = 0b01000000;

var serialPort,
    txBuffer,
    rxBuffer,
    stage = IDLE,
    statuses = {},
    lastStatusAddr,
    lastNodeAddr = 0,
    addressingStageTimeout,
    nodeRegistration,
    cellSentSignatures = [],
    discoCntrl = disco.controller,
    lastStage = 0;
    // stageTimer = 0;


// Set our address on the parser
// MessageParser.setMyAddress(MessageParser.MASTER_ADDRESS);


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
        this.handleMessage(message);
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
    // var now = Date.now();

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

    // Declare stage change
    if (lastStage != stage) {
      this.emit('stage-change', stage, lastStage);
    //  if (lastStage) {
    //    console.log(stringForStage(lastStage), ' took', (now - stageTimer) +'ms');
    //  }
    //  stageTimer = now;
      lastStage = stage;
    }

    // Setup and call the new status handler on the next tick of the event loop
    switch(stage) {
      case ADDRESSING:
        process.nextTick(this.addressing.bind(this));
      break;
      case STATUSING:
        // console.log('STATUSING');
        lastStatusAddr = 0;
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
        cellSentSignatures[addr] = {
          cmdID: 0,
          signature: colorSignatureForCell(null)
        };

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
    Get the status from all floor nodes

    @method status
    @param {MessageParser} message (optional) The most recent message received while in this stage
  */
  this.status = function(message) {

    // Start a streaming response for status
    if (!message) {
      rxBuffer.startStreamingResponse(MessageParser.TYPE_STATUS, lastNodeAddr);
    }

    // Processes statuses
    else if (message.isReady()) {
      statuses = message.getMessageBody();
      statuses.unshift(0); // so that indexes match addresses (i.e. 1,2,3...)
      this.nextStage();
    }
  },

  /**
    Handle the node update stage
  */
  this.update = function() {
    var broadcast = true,
        updates = {},
        lastSignature;

    // Figure out all the nodes that need to be updated
    nodeRegistration.forEach(function(addr){
      var cell      = discoCntrl.getCellByAddress(addr),
          status    = statuses[addr] || 0,
          cmdID     = status & 0x07,
          sensorVal = (status & SENSOR_DETECT) ? 1 : 0,
          isFading  = (status & FADING) ? 1 : 0,
          lastSent  = cellSentSignatures[addr],
          cellSig   = colorSignatureForCell(cell);

      // Could not find cell or status
      if (!cell || !status) {
        return;
      }

      // Update FloorCell values
      if (!isFading && cell.isFading()) {
        cell.stopFade();
      }
      cell.setValue(sensorVal);

      // If the cell did not receive the last message or
      // the FloorCell object has changed, update this cell
      if (!lastSent || cmdID != lastSent.cmdID || cellSig != lastSent.signature) {
        updates[addr] = cell;

        if (broadcast && cellSig != lastSignature) {
          broadcast = false;
        }
        lastSignature = cellSig;
      } else {
        broadcast = false;
      }
    });

    // Update floor cells
    var i = 0;
    for (var addr in updates) if (updates.hasOwnProperty(addr)) {
      i++;
      var cell = updates[addr];
      updateFloorCell(addr, cell, broadcast);

      // No need to continue, we've already told everyone
      if (broadcast) {
        break;
      }
    }

    this.nextStage();
  };
}
util.inherits(Comm, EventEmitter);

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
    rxBuffer = new MessageParser(emitter);
  } else {
    rxBuffer.serialEmitter = emitter;
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
  tx.setAddress(MessageParser.BROADCAST_ADDRESS);
  tx.write(lastNodeAddr);
  tx.sendEvery(ACK_TIMEOUT);

  return tx;
}

/**
  Sends the values from FloorCell to the physical cell node

  @private
  @function updateFloorCell
  @param {byte} addr The address of the node to update
  @param {FloorCell} cell The object to get the cell state from
  @param {boolean} broadcast (optional) If `true`, broadcast this to all floor nodes
  @return MessageParser
*/
function updateFloorCell(addr, cell, broadcast) {
  if (disco.emulatedFloor) return Promise.resolve();

  var tx = new MessageParser(),
      type, data, duration,
      sendSignature = cellSentSignatures[addr];

  sendSignature.cmdID = (sendSignature.cmdID >= 7) ? 0 : sendSignature.cmdID + 1;
  sendSignature.signature = colorSignatureForCell(cell);

  if (cell.isFading()) {
    type = MessageParser.TYPE_FADE;
    data = cell.getFadeColor();
    duration = cell.getFadeDuration();

    // Break duration into 2 bytes
    data.push((duration >> 8) & 0xFF);
    data.push(duration & 0xff);
  }
  else {
    type = MessageParser.TYPE_COLOR;
    data = cell.getColor();
  }
  data.push(sendSignature.cmdID);

  // Send message
  tx.start(type);
  if (broadcast) {
    tx.setAddress(MessageParser.BROADCAST_ADDRESS);
  } else {
    tx.setAddress(addr);
  }
  tx.write(data);
  tx.send();
  return tx;
}

/**
  Return an string that represents the current color state of the
  cell in the format:

  ```
  <R>,<G>,<B>,<D>
  ```
  R, G, B: Red, Green, Blue values
  D: Fading duration or 0

  @method colorSignatureForCell
  @param {FloorCell} cell
  @return {String}
*/
function colorSignatureForCell(cell) {
  var signature = [0, 0, 0, 0];

  if (cell) {
    if (cell.isFading()) {
      signature = cell.getFadeColor();
      signature.push(cell.getFadeDuration());
    }
    else {
      signature = cell.getColor();
      signature.push(0);
    }
  }

  return signature.join(',');
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
    // console.log('Detected change: '+ sensorDetect +' on '+ addr);
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
  tx.setAddress(addr);
  return tx.send();
}

/**
  Return a string for the STAGE constant

  @function stringForStage
  @param {int} stage
*/
function stringForStage(stage) {
  switch (stage) {
    case ADDRESSING:
      return 'ADDRESSING';
    case STATUSING:
      return 'STATUSING';
    case UPDATING:
      return 'UPDATING';
    default:
      return 'UNKNOWN';
  }
}

module.exports = new Comm();