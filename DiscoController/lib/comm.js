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
    Promise       = require('bluebird'),
    _             = require('underscore');

const BAUD_RATE            = 500000;
const ACK_TIMEOUT          = 100;
const STATUS_TIMEOUT       = 50;
const ADDRESSING_TIMEOUT   = 4000;
const DELAY_BETWEEN_STAGES = 5;
const NULL_SIGNATURE       = '0,0,0,0';

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
    hasReset = false,
    statuses = [],
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
    @param {boolean} reAddress (optional) Set to FALSE to skip the addressing phase
    @param {int} nodeCount (optional) If reAddress is `true`, set to the number of cells are on the floor
    @return SerialPort
  */
  this.start = function (port, reAddress, nodeCount){
    nodeRegistration = [];

    serialPort = new Serial(port, {
      baudrate: BAUD_RATE,
      parser: serialParser,
      rtscts: false,
    });

    // Open and process incoming data
    serialPort.on('open', function () {
      MessageParser.setSerialPort(serialPort);

      // Listen for new messages
      MessageParser.events.on('message-ready', function(message) {
        this.handleMessage(message);
      }.bind(this));

      // Skip floor addressing and just add all the floor nodes from last time
      if (reAddress === false && typeof nodeCount == 'number' && nodeCount > 0) {
        for (var i = 1; i < nodeCount + 1; i++) {
          this.registerNode(i);
        }
        this.emit('done-addressing', nodeRegistration.length);
        stage = UPDATING;
      }

      // Start node address registration
      txBuffer = null;
      this.nextStage();
    }.bind(this));

    return serialPort;
  };

  /**
    Disconnect the serial port

    @method close
    @return Promise
  */
  this.close = function() {
    return new Promise(function(resolve, reject) {
      try {
        if (serialPort && serialPort.isOpen()) {
          serialPort.close(function(err){
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      } catch(e) {
        reject(e.message);
      }
    }.bind(this));
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
          if (txBuffer) {
            txBuffer.stopSending();
          }

          // Bring enable pin low
          // serialPort.set({rts:true}, function(){});

          stage = UPDATING;
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
        stage = UPDATING;
        // stage = STATUSING;
      break;
    }

    // Declare stage change
    if (lastStage != stage) {
      this.emit('stage-change', stage, lastStage);
      lastStage = stage;
    }

    // Setup and call the new status handler on the next tick of the event loop
    switch(stage) {
      case ADDRESSING:
        serialPort.set({rts:false}, function(){
          // process.nextTick(this.addressing.bind(this));
          setTimeout(this.addressing.bind(this), DELAY_BETWEEN_STAGES);
        }.bind(this));
      break;
      case STATUSING:
        // console.log('STATUSING');
        lastStatusAddr = 0;
        // process.nextTick(this.status.bind(this));
        setTimeout(this.status.bind(this), DELAY_BETWEEN_STAGES);
      break;
      case UPDATING:
        // console.log('UPDATING');
        // process.nextTick(this.batchUpdate.bind(this));
        setTimeout(this.batchUpdate.bind(this), DELAY_BETWEEN_STAGES);
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

    // First reset nodes
    if (!hasReset) {
      txBuffer = new MessageParser();
      txBuffer.start(MessageParser.TYPE_RESET, MessageParser.BROADCAST_ADDRESS);
      txBuffer.send()
      .then(function(){
        txBuffer = null;
        hasReset = true;
        this.addressing();
      }.bind(this));
    }

    // Enable the first node and then start addresses
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
        this.registerNode(addr);

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
        txBuffer.start(MessageParser.TYPE_NACK, addr);
        txBuffer.send()
        .then(function(){
          txBuffer = sendAddressingRequest();
        });
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
    Do a batch color update in a single message
  */
  this.batchUpdate = function() {
    try {
      var tx = new MessageParser(),
          data = [],
          now = Date.now(),
          broadcast = true,
          lastColor, lastSignature,
          batch = 0,
          i, crc, batchTimer;

      // Start batch message
      data = [MessageParser.MSG_SOM, MessageParser.MSG_SOM,
              MessageParser.BROADCAST_ADDRESS,
              nodeRegistration.length,
              MessageParser.TYPE_BATCH,
              3,
              MessageParser.TYPE_COLOR];
      i = data.length;

      // Build message data
      nodeRegistration.forEach(function(addr){
        var cell      = discoCntrl.getCellByAddress(addr),
            color     = (cell.isFading()) ? cell.processFadeIncrement(now) : cell.getColor(),
            cellSig   = colorSignatureForCell(cell);

        data[i++] = addr;
        data[i++] = addr;
        for (var c = 0; c < 3; c++) {
          data[i++] = color[c];
        }

        if (broadcast && lastSignature && (cellSig != lastSignature || color.join(',') != lastColor.join(','))) {
          broadcast = false;
        }
        lastColor = color;
        lastSignature = cellSig;
      });

      // Broadcast update
      if (broadcast && lastSignature) {
        tx.start(MessageParser.TYPE_COLOR);
        tx.setAddress(MessageParser.BROADCAST_ADDRESS);
        tx.write(lastColor);
        tx.send().then(this.nextStage.bind(this));
      }
      // Batch update
      else {

        // Calculate CRC
        crc = tx.generateCRC(null, data.slice(2));
        data[i++] = (crc >> 8) & 0xFF;
        data[i++] = crc & 0xff;

        // Send in 50 byte batches, since the arduino serial buffer is only 64 bytes
        batchTimer = setInterval(function(){
          var start = batch * 50;
          batch++;

          if (start < data.length) {
            tx.start();
            tx.sendRawData(data.slice(start, start + 50));
          } else {
            clearInterval(batchTimer);
            this.nextStage();
            this.emit('floor-updated');
          }

        }.bind(this), 1);
      }
    } catch(e) {
      console.error(e.message);
      console.error(e.stack);
      this.nextStage.bind(this);
    }
  };

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
      if (!cell) {
        return;
      }

      // Update FloorCell values
      cell.setValue(sensorVal);

      // If the cell did not receive the last message or
      // the FloorCell object has changed, update this cell
      if (!lastSent || cmdID != lastSent.cmdID || cellSig != lastSent.signature) {
        updates[addr] = cell;

        if (broadcast && lastSignature && cellSig != lastSignature) {
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

    this.emit('floor-updated');
    this.nextStage();
  };

  /**
    Register a new node

    @param {int} addr The address of the new node
  */
  this.registerNode = function(addr) {
    nodeRegistration.push(addr);
    cellSentSignatures[addr] = {
      cmdID: 0,
      signature: colorSignatureForCell(null)
    };

    discoCntrl.addCellWithAddress(addr);
    console.log('Add node at address', addr);

    lastNodeAddr = addr;
    this.emit('new-node', addr);
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
  if (discoCntrl.emulatedFloor) return Promise.resolve();

  var tx = new MessageParser(),
      type, data, duration,
      sendSignature = cellSentSignatures[addr];

  sendSignature.cmdID = (sendSignature.cmdID >= 7) ? 0 : sendSignature.cmdID + 1;
  sendSignature.signature = colorSignatureForCell(cell);

  // Fading message
  if (cell.isFading()) {
    type = MessageParser.TYPE_FADE;
    data = cell.getFadeColor();
    duration = cell.getFadeDuration();

    // Break duration into 2 bytes
    data.push((duration >> 8) & 0xFF);
    data.push(duration & 0xff);
  }
  // Color message
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
  tx.send().then(function(){
    cellSentSignatures[addr] = sendSignature;
  });

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