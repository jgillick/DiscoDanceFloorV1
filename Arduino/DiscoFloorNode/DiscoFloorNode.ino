/*
  See README for description and pin assignment
*/

#include "LEDFader.h"
// #include "RGBFade.h"
// #include "CapacitiveSensor.h"
#include "CapacitiveTouch.h"
#include "MessageBuffer.h"
#include "Constants.h"

#include <EEPROM.h>
#include <avr/wdt.h>

uint8_t myAddress = 0,
        lastCmdID = 0;
uint32_t lastPrint = 0;

boolean needsAck          = false, // TRUE if we're waiting for an ACK
        enabledState      = false, // is the node enabled
        gotSensorValue    = false,
        lastSensorValue   = false,
        receivedSomething = false;

// The RGB LEDs
LEDFader rgb[3] = { LEDFader(LED_RED),
                    LEDFader(LED_GREEN),
                    LEDFader(LED_BLUE) };
// RGBFade fadeCtrl;

// Sensor
// CapacitiveSensor sensor = CapacitiveSensor(SENSOR_SEND, SENSOR_TOUCH);
CapacitiveTouch sensor = CapacitiveTouch(SENSOR_SEND);

// Message buffers
MessageBuffer txBuffer(TX_CONTROL, RX_CONTROL);
MessageBuffer rxBuffer(TX_CONTROL, RX_CONTROL);

void setup() {
  pinMode(NEXT_NODE,   OUTPUT);
  pinMode(TX_CONTROL,  OUTPUT);
  pinMode(RX_CONTROL,  OUTPUT);
  pinMode(ENABLE_NODE, INPUT);

  digitalWrite(TX_CONTROL, RS485Receive);
  digitalWrite(RX_CONTROL, RS485Receive);

  // Pull address from EEPROM
  // uint8_t addr = EEPROM.read(EEPROM_CELL_ADDR);
  // if (addr > 0 && addr < 255) {
  //   myAddress = addr;
  //   txBuffer.setMyAddress(myAddress);
  //   rxBuffer.setMyAddress(myAddress);
  // }

  // Init serial communication
  Serial.begin(500000);

  // Reboot if the node stalls for 2 seconds
  wdt_enable(WDTO_2S);

  sensor.setGain(3);
  sensor.filterTuning(0.3, 40, 320);
  sensor.begin();

  // fadeCtrl.begin();
}

void loop() {
  // long now = millis();

  // The program is still alive
  wdt_reset();

  // Update non-blocking LED fade
  updateLEDs();

  // Process message received from the bus
  rxBuffer.read();
  if (rxBuffer.isReady()) {
    receivedSomething = true;
    processMessage();
  }
  if (rxBuffer.isStreaming()) {
    setStreamingValue();
  }

  // if (sensor.sensorValue() >= SENSOR_THRESHOLD) {
  //   setColor(0, 250, 0);
  // } else {
  //   setColor(0, 0, 0);
  // }
  // Serial.println(sensor.sensorValue());

  // if (now > lastPrint + 100) {
  //   Serial.println(sensor.sensorValue());
  //   lastPrint = now;
  // }

  // Resend message
  // if (needsAck && now > txBuffer.sentAt + ACK_TIMEOUT) {
  //   txBuffer.send();
  // }
}

void idleMode() {
  bool val = sensorValue();
  if (val != lastSensorValue) {
    if (val) {
      fadeToColor(500, 255, 255, 255);
    } else {
      fadeToColor(500, 0, 0, 0);
    }
  }
}

void processMessage() {

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

  // Address set, tell next node to set address
  if (txBuffer.getType() == TYPE_ADDR) {
    addressConfirmed();
  }
}

// Out address has been confirmed, enable the next node
void addressConfirmed() {
  EEPROM.write(EEPROM_CELL_ADDR, myAddress);
  digitalWrite(NEXT_NODE, HIGH);
}

// Provided a value for the streaming response
void setStreamingValue() {
  switch(rxBuffer.getType()) {
    case TYPE_STATUS:
      rxBuffer.setStreamingValue(getStatusFlag());
    break;
    case TYPE_SENSE:
      rxBuffer.setStreamingValue(sensor.rawValue());
    break;
  }
}

// Process messages addressed to me
void myMessage() {
  switch(rxBuffer.getType()) {
    case TYPE_RESET:
      myAddress = 0;
      txBuffer.setMyAddress(myAddress);
      rxBuffer.setMyAddress(myAddress);
    break;
    case TYPE_ACK:
      processACK();
    break;
    case TYPE_COLOR:
      handleColorMessage();
    break;
    case TYPE_FADE:
      handleFadeMessage();
    break;
    case TYPE_STATUS:
      if (rxBuffer.addressedToMe()) {
        // Serial.print(F("S!")); delay(1);
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
        // Serial.print(F("S~")); delay(1);
        delay(5);
        sendStatus();
      }
    break;
  }
}

// Generates a flag that contains the current status of the cell
uint8_t getStatusFlag() {
  uint8_t flag = 0;

  // The last command ID should only be in the first 3 bits
  flag |= lastCmdID & 0x07;

  if (isFading()) {
    flag |= FADING;
  }

  if (sensor.sensorValue() >= SENSOR_THRESHOLD) {
    flag |= SENSOR_DETECT;
  }

  return flag;
}

// Send node status to master
void sendStatus() {

  uint8_t flag = getStatusFlag();
  int32_t sensorVal = sensor.sensorValue();

  txBuffer.start(TYPE_STATUS);
  txBuffer.write(flag);

  // Current color
  txBuffer.write(rgb[0].get_value());
  txBuffer.write(rgb[1].get_value());
  txBuffer.write(rgb[2].get_value());
  // txBuffer.write(fadeCtrl.getColor(), 3);

  // Target color
  if (isFading()){
    txBuffer.write(rgb[0].get_target_value());
    txBuffer.write(rgb[1].get_target_value());
    txBuffer.write(rgb[2].get_target_value());
    // txBuffer.write(fadeCtrl.getTargetColor(), 3);
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
  return (sensor.sensorValue() >= SENSOR_THRESHOLD);
  // return (sensor.capacitiveSensor(30) >= SENSOR_THRESHOLD);
}

// Set the LED color
void handleColorMessage() {
  // Serial.println(F("Set color!"));

  uint8_t *data = rxBuffer.getBody();
  uint8_t len = rxBuffer.getBodyLen();

  // Invalid message
  if (rxBuffer.getBodyLen() != 4) return;

  // Set colors
  setColor(data[0], data[1], data[2]);

  // Command ID
  lastCmdID = data[3];
}

// Set LED fade
void handleFadeMessage() {
  // Serial.println(F("Set fade!"));

  uint8_t *data = rxBuffer.getBody();
  uint16_t duration;

  // Invalid message
  if (rxBuffer.getBodyLen() != 6) return;

  // Duration is two bytes that make up 16 bits
  duration = (data[3] << 8) | data[4];
  // duration = data[3] * FADE_DIVIDER;
  // if (len > 4) {
  //   for (int i = 4; i < len; i++) {
  //     duration += data[i] * FADE_DIVIDER;
  //   }
  // }

  // Set colors
  fadeToColor(duration, data[0], data[1], data[2]);

  // Command ID
  lastCmdID = data[5];
}


// Set an address if one hasn't been defined yet
void setAddress() {
  uint8_t addr,
          enabled = digitalRead(ENABLE_NODE);

  // Must have crashed and rebooted because we're enabled,
  // and the RX message is past the addressing stage
  // Get address from the EEPROM
  if (enabled && rxBuffer.getType() > TYPE_ADDR) {
    addr = EEPROM.read(EEPROM_CELL_ADDR);
    if (addr > 0 && addr < 255) {
      myAddress = addr;
      txBuffer.setMyAddress(myAddress);
      rxBuffer.setMyAddress(myAddress);
      return;
    }
    else {
      addr = 0;
    }
  }

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

void updateLEDs() {
  rgb[0].update();
  rgb[1].update();
  rgb[2].update();
}

bool isFading() {
  // return fadeCtrl.isFading();
  return rgb[0].is_fading() || rgb[1].is_fading() || rgb[2].is_fading();
}

void setColor(uint8_t red, uint8_t green, uint8_t blue) {
  rgb[0].set_value(red);
  rgb[1].set_value(green);
  rgb[2].set_value(blue);
  // fadeCtrl.setColor(red, green, blue);
}

void fadeToColor(uint16_t time, uint8_t red, uint8_t green, uint8_t blue) {
  rgb[0].fade(red, time);
  rgb[1].fade(green, time);
  rgb[2].fade(blue, time);
  // fadeCtrl.fadeTo(red, green, blue, time);
}