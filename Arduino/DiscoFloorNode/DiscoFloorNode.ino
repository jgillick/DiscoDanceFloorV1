/*
  See README for description and pin assignment
*/

#include "RGBFade.h"
// #include "CapacitiveSensor.h"
// #include "CapacitiveTouch.h"
#include "MessageBuffer.h"
#include "Constants.h"

#include <EEPROM.h>
#include <avr/wdt.h>

uint8_t myAddress = 0,
        lastCmdID = 0,
        enablePin = 0,
        nextPin   = 0;

boolean needsAck          = false, // TRUE if we're waiting for an ACK
        enabledState      = false, // is the node enabled
        gotSensorValue    = false,
        lastSensorValue   = false,
        daisyPinsSet      = false;

// The RGB LEDs
RGBFade fadeCtrl;

// Sensor
// CapacitiveSensor sensor = CapacitiveSensor(SENSOR_SEND, SENSOR_TOUCH);
// CapacitiveTouch sensor = CapacitiveTouch(SENSOR_SEND);

// Message buffers
MessageBuffer txBuffer(TX_CONTROL, RX_CONTROL);
MessageBuffer rxBuffer(TX_CONTROL, RX_CONTROL);

void setup() {
  // Reboot if the node stalls for 2 seconds
  wdt_enable(WDTO_2S);

  resetDaisyPins();
  pinMode(TX_CONTROL,  OUTPUT);
  pinMode(RX_CONTROL,  OUTPUT);

  digitalWrite(TX_CONTROL, RS485Receive);
  digitalWrite(RX_CONTROL, RS485Receive);

  // Init serial communication
  Serial.begin(SERIAL_BAUD);

  // Pull address from EEPROM
  uint8_t addr = EEPROM.read(EEPROM_CELL_ADDR);
  if (addr > 0 && addr < 255) {
    myAddress = addr;
    txBuffer.setMyAddress(myAddress);
    rxBuffer.setMyAddress(myAddress);
  }

  // sensor.setGain(3);
  // sensor.filterTuning(0.3, 40, 320);
  // sensor.begin();

  fadeCtrl.begin();
}

void loop() {
  static uint32_t timeout = 0;
  wdt_reset();
  timeout++;

  // Check polarity of daisy chain pins (enable/next)
  if (!daisyPinsSet) {
    if (digitalRead(DAISY_1) == HIGH) {
      enablePin = DAISY_1;
      nextPin = DAISY_2;
      daisyPinsSet = true;
    }
    else if (digitalRead(DAISY_2) == HIGH) {
      enablePin = DAISY_2;
      nextPin = DAISY_1;
      daisyPinsSet = true;
    }

    if (daisyPinsSet) {
      pinMode(nextPin, OUTPUT);
      digitalWrite(nextPin, LOW);
    }
  }

  // Read from bus
  setStreamingValue();
  rxBuffer.read();
  if (rxBuffer.isReady()) {
    timeout = 0;
    processMessage();
  }
  else if (rxBuffer.getType() > MSG_STATE_IDL && rxBuffer.getType() < MSG_STATE_ABT) {
    timeout = 0;
  }

  if (rxBuffer.isStreaming() && !rxBuffer.isStreamingValueSet()) {
    timeout = 0;
  }

  // If we haven't heard from master in awhile, we should turn everything off
  if (timeout > 150000) {
    fadeCtrl.setColor(0, 0, 0);
    timeout = 0;
  }
}

void resetDaisyPins() {
  nextPin = 0;
  enablePin = 0;
  daisyPinsSet = false;
  pinMode(DAISY_1, INPUT);
  pinMode(DAISY_2, INPUT);
}

void processMessage() {

  // Looks like we're past addressing, drop daisy chain pins
  if (daisyPinsSet && rxBuffer.getType() < TYPE_ADDR && rxBuffer.getType() > TYPE_ACK) {
    resetDaisyPins();
  }

  // No ID defined yet
  if (myAddress == 0) {
    setAddress();
  }

  // Addressed to us
  else if (rxBuffer.addressedToMe()){
    myMessage();
  }
  else {
    masterMessage();
  }

  rxBuffer.reset();
}

// Process an ACK received
void processACK() {
  needsAck = false;
  if (txBuffer.getType() == TYPE_ADDR) {
    addressConfirmed();
  }
}

// Process a NACK
void processNACK() {
  needsAck = false;
  if (txBuffer.getType() == TYPE_ADDR) {
    myAddress = 0;
    rxBuffer.setMyAddress(0);
    txBuffer.setMyAddress(0);
    txBuffer.reset();
  }
}

// Out address has been confirmed, enable the next node
void addressConfirmed() {
  EEPROM.write(EEPROM_CELL_ADDR, myAddress);
  if (daisyPinsSet) {
    digitalWrite(nextPin, HIGH);
  }
}

// Provided a value for the streaming response
void setStreamingValue() {
  switch(rxBuffer.getType()) {
    case TYPE_STATUS:
      rxBuffer.setStreamingValue(getStatusFlag());
    break;
  }
}

// Process messages addressed to me
void myMessage() {

  if (rxBuffer.isStreaming()) {
    return;
  }

  switch(rxBuffer.getType()) {
    case TYPE_RESET:
      resetDaisyPins();
      myAddress = 0;
      txBuffer.setMyAddress(0);
      rxBuffer.setMyAddress(0);
      setColor(0,0,0);
    break;
    case TYPE_ACK:
      processACK();
    break;
    case TYPE_NACK:
      processNACK();
    break;
    case TYPE_COLOR:
      handleColorMessage();
    break;
    case TYPE_FADE:
      handleFadeMessage();
    break;
    case TYPE_STATUS:
      if (rxBuffer.addressedToMe()) {
        sendStatus();
      }
      // Preload sensor value, since we're up soon and the call is blocking.
      // TODO: Replace with non-blocking lib
      // else if (!gotSensorValue){
      //   lastSensorValue = sensorValue();
      //   gotSensorValue = true;
      // }
    break;
    case TYPE_ADDR:
      // Maybe someone didn't hear our address
      if (txBuffer.getType() == TYPE_ADDR && needsAck == true) {

        // Master didn't hear our address, resend
        if (rxBuffer.getBody()[0] == myAddress - 1) {
          txBuffer.send();
        }
        // We didn't hear master's ACK
        else if (rxBuffer.getBody()[0] == myAddress) {
          needsAck = false;
          addressConfirmed();
        }
      }
    break;
  }
}

// Observe any messages are going to master
void masterMessage() {
  uint8_t src = rxBuffer.getAddress();

  switch(rxBuffer.getType()) {
    case TYPE_STATUS:
      // If the previous node sent it's status to mater, send ours next.
      if (rxBuffer.getBodyLen() > 0 && src + 1 == myAddress) {
        sendStatus();
      }
    break;
  }
}

// Generates a flag that contains the current status of the cell
uint8_t getStatusFlag() {
  uint8_t flag = 0;

  // The last command ID should only be in the first 3 bits
  flag |= (lastCmdID & 0x07);

  if (isFading()) {
    flag |= FADING;
  }

  // if (sensor.sensorValue() >= SENSOR_THRESHOLD) {
  //   flag |= SENSOR_DETECT;
  // }

  return flag;
}

// Send node status to master
void sendStatus() {
  uint8_t flag = getStatusFlag();
  int32_t sensorVal = 0; //sensor.sensorValue();

  txBuffer.start(TYPE_STATUS);
  txBuffer.write(flag);

  // Current color
  txBuffer.write(fadeCtrl.getColor(), 3);

  // Target color
  if (isFading()){
    txBuffer.write(fadeCtrl.getTargetColor(), 3);
  }

  // Sensor value
  if (sensorVal >= 255) {
    txBuffer.write(255);
  } else if(sensorVal <= 0) {
    txBuffer.write(0);
  } else {
    txBuffer.write(sensorVal);
  }

  txBuffer.send();
  gotSensorValue = false;
}

// 1 if sensor detects someone
bool sensorValue() {
  return 0;
  // return (sensor.sensorValue() >= SENSOR_THRESHOLD);
  // return (sensor.capacitiveSensor(30) >= SENSOR_THRESHOLD);
}

// Set the LED color
void handleColorMessage() {
  uint8_t *data = rxBuffer.getBody();
  uint8_t len = rxBuffer.getBodyLen();

  // Invalid message
  if (rxBuffer.getBodyLen() < 3) return;

  // Set colors
  setColor(data[0], data[1], data[2]);

  // Command ID
  if (len > 3) {
    lastCmdID = data[3];
  }
}

// Set LED fade
void handleFadeMessage() {
  uint8_t *data = rxBuffer.getBody();
  uint16_t duration;

  // Invalid message
  if (rxBuffer.getBodyLen() != 6) return;

  // Duration is two bytes that make up 16 bits
  duration = (data[3] << 8) | data[4];

  // Set colors
  fadeToColor(data[0], data[1], data[2], duration);

  // Command ID
  lastCmdID = data[5];
}


// Set an address if one hasn't been defined yet
void setAddress() {
  uint8_t addr,
          enabled = (daisyPinsSet) ? digitalRead(enablePin) : 0;

  // Must have crashed and rebooted because we're enabled,
  // and the RX message is past the addressing stage
  // Get address from the EEPROM
  // if (enabled && rxBuffer.getType() < TYPE_ADDR) {
  //   addr = EEPROM.read(EEPROM_CELL_ADDR);
  //   if (addr > 0 && addr < 255) {
  //     myAddress = addr;
  //     txBuffer.setMyAddress(myAddress);
  //     rxBuffer.setMyAddress(myAddress);
  //     return;
  //   }
  //   else {
  //     addr = 0;
  //   }
  // }

  // Just enabled, clear RX and wait for next address (in case current RX is stale)
  if (enabled && enabledState == false) {
    rxBuffer.reset();
    enabledState = true;
  }

  // Set address
  else if (enabled && rxBuffer.getType() == TYPE_ADDR) {
    addr = (uint8_t)rxBuffer.getBody()[0];
    myAddress = addr + 1;
    txBuffer.setMyAddress(myAddress);
    rxBuffer.setMyAddress(myAddress);

    // Announce address to master
    txBuffer.start(TYPE_ADDR);
    txBuffer.write(myAddress);
    txBuffer.send();

    needsAck = true;
  }
}

bool isFading() {
  return fadeCtrl.isFading();
}

void setColor(uint8_t red, uint8_t green, uint8_t blue) {
  fadeCtrl.setColor(red, green, blue);
}

void fadeToColor(uint8_t red, uint8_t green, uint8_t blue, uint16_t time) {
  fadeCtrl.fadeTo(red, green, blue, time);
}