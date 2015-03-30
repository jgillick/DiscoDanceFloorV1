/*
  See README for description and pin assignment
*/

#include "LEDFader.h"
#include "CapacitiveSensor.h"
#include "MessageBuffer.h"
#include "Constants.h"

#include <EEPROM.h>
#include <avr/wdt.h>

// #ifdef DUMMY_MASTER
// #include "TestMaster.h"
// #endif

long lastPing = 0;
uint8_t ledOn = 1;
uint8_t myAddress       = 0;
boolean needsAck        = false, // TRUE if we're waiting for an ACK
        enabledState    = false, // is the node enabled
        gotSensorValue  = false,
        lastSensorValue = false;

// The RGB LEDs
LEDFader rgb[3] = { LEDFader(LED_RED),
                    LEDFader(LED_GREEN),
                    LEDFader(LED_BLUE) };

// Sensor
CapacitiveSensor sensor = CapacitiveSensor(SENSOR_SEND, SENSOR_TOUCH);

// Message buffers
MessageBuffer txBuffer(TX_CONTROL);
MessageBuffer rxBuffer(TX_CONTROL);

// Testing
// #ifdef DUMMY_MASTER
// boolean isMaster = false;
// TestMaster     dummyMaster(&rxBuffer, &txBuffer);
// #endif

void setup() {
  pinMode(NEXT_NODE,   OUTPUT);
  pinMode(TX_CONTROL,  OUTPUT);
  pinMode(NODE_STATUS, OUTPUT);
  pinMode(ENABLE_NODE, INPUT);

  digitalWrite(TX_CONTROL, RS485Receive);

  // Init serial communication
  Serial.begin(250000);

  // Reboot if the node stalls for 1 second
  wdt_enable(WDTO_2S);

  // This is the master node
#ifdef DUMMY_MASTER
  debugSerial.begin(9600);

  pinMode(ENABLE_MASTER, INPUT);
  isMaster = (digitalRead(ENABLE_MASTER) == HIGH);
  if (isMaster) {
    dummyMaster.setup();
  }
  else {
    delay(1000);
    Serial.println(F("I'm a node."));
  }
#endif

  digitalWrite(NODE_STATUS, HIGH);
}

void loop() {
  long now = millis();

  // The program is still alive
  wdt_reset();

  // Send deubbging ping
  if (lastPing + 500 < now) {
    // Serial.print(F("P")); delay(1);
    digitalWrite(NODE_STATUS, ledOn);
    ledOn = (ledOn == 0) ? 1 : 0;
    lastPing = now;
  }

#ifdef DUMMY_MASTER
  // Skip to TestMater loop
  if (isMaster) {
    dummyMaster.loop();
    return;
  }
#endif

  // Update non-blocking LED fade
  updateLEDs();

  // Process message received from the bus
  rxBuffer.read();
  if (rxBuffer.isReady()) {
    processMessage();
  }

  // Resend message
  // if (needsAck && now > txBuffer.sentAt + ACK_TIMEOUT) {
  //   txBuffer.send();
  // }
}

void processMessage() {

  // No ID defined yet
  if (myAddress == 0) {
    // Serial.print(F("A"));
    // Serial.write(myAddress); delay(1);
    setAddress();
  }

  // Messages to Master
  else if (rxBuffer.addressedToMaster()) {
    masterMessage();
  }

  // Addressed to us
  else if (rxBuffer.addressedToMe()){
    myMessage();
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

// Process messages addressed to me
void myMessage() {
  switch(rxBuffer.getType()) {
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
      if (rxBuffer.getLowerDestRange() == myAddress) {
        // Serial.print(F("S!")); delay(1);
        sendStatus();
      }
      // Preload sensor value, since we're up soon and the call is blocking.
      // TODO: Replace with non-blocking lib
      else if (!gotSensorValue){
        lastSensorValue = sensorValue();
        gotSensorValue = true;
      }
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
  uint8_t src = rxBuffer.getSourceAddress();

  switch(rxBuffer.getType()) {
    case TYPE_STATUS:
      // If the previous node sent it's status to mater, send ours next.
      if (src + 1 == myAddress) {
        // Serial.print(F("S~")); delay(1);
        delay(5);
        sendStatus();
      }
    break;
  }
}

// Send node status to master
void sendStatus() {

  uint8_t flag = 0;
  bool fading = isFading();

  if (!gotSensorValue) {
    lastSensorValue = sensorValue();
  }

  // Define cell flags
  if (fading) {
    flag |= FADING;
  }
  if (lastSensorValue) {
    flag |= SENSOR_DETECT;
  }

  txBuffer.start(TYPE_STATUS);
  txBuffer.setDestAddress(MASTER_ADDRESS);
  txBuffer.write(flag);

  // Current color
  txBuffer.write(rgb[0].get_value());
  txBuffer.write(rgb[1].get_value());
  txBuffer.write(rgb[2].get_value());

  // Target color
  if (fading){
    txBuffer.write(rgb[0].get_target_value());
    txBuffer.write(rgb[1].get_target_value());
    txBuffer.write(rgb[2].get_target_value());
  }

  txBuffer.send();
  gotSensorValue = false;
}

// 1 if sensor detects someone
bool sensorValue() {
  return (sensor.capacitiveSensor(30) >= SENSOR_THRESHOLD);
}

// Set the LED color
void handleColorMessage() {
  // Serial.println(F("Set color!"));

  uint8_t *colors = rxBuffer.getBody();

  // Invalid color
  if (rxBuffer.getBodyLen() != 3) return;

  // Set colors
  setColor(colors[0], colors[1], colors[2]);
}

// Set LED fade
void handleFadeMessage() {
  // Serial.println(F("Set fade!"));

  uint8_t *data = rxBuffer.getBody();
  uint8_t len = rxBuffer.getBodyLen();
  int duration;

  // Invalid message
  if (len < 4) return;

  // Duration
  // Last numbers are duration divided
  // by FADE_DIVIDER (250) and added together
  duration = data[3] * FADE_DIVIDER;
  if (len > 4) {
    for (int i = 4; i < len; i++) {
      duration += data[i] * FADE_DIVIDER;
    }
  }

  // Set colors
  fadeToColor(duration, data[0], data[1], data[2]);
}


// Set an address if one hasn't been defined yet
void setAddress() {
  uint8_t addr,
          enabled = digitalRead(ENABLE_NODE);

  // Must have crashed and rebotted because  we're enabled,
  // and the RX message is past the addressing stage
  // Get address from the EEPROM
  if (enabled == HIGH && rxBuffer.getType() > TYPE_ADDR) {
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
  if (enabled == HIGH && enabledState == false) {
    rxBuffer.reset();
    enabledState = true;
  }

  // Set address
  else if (enabled == HIGH && rxBuffer.getType() == TYPE_ADDR) {
    addr = (uint8_t)rxBuffer.getBody()[0];

    // Valid addresses are greater than MASTER
    if (addr >= MASTER_ADDRESS) {

      myAddress = addr + 1;
      txBuffer.setMyAddress(myAddress);
      rxBuffer.setMyAddress(myAddress);

      // Announce address to master
      txBuffer.start(TYPE_ADDR);
      txBuffer.setDestAddress(MASTER_ADDRESS);
      txBuffer.write(myAddress);
      txBuffer.send();

      needsAck = true;
    }
  }
}

void updateLEDs() {
  rgb[0].update();
  rgb[1].update();
  rgb[2].update();
}

bool isFading() {
  return rgb[0].is_fading() || rgb[1].is_fading() || rgb[2].is_fading();
}

void setColor(uint8_t red, uint8_t green, uint8_t blue) {
  rgb[0].set_value(red);
  rgb[1].set_value(green);
  rgb[2].set_value(blue);
}

void fadeToColor(int time, uint8_t red, uint8_t green, uint8_t blue) {
  rgb[0].fade(red, time);
  rgb[1].fade(green, time);
  rgb[2].fade(blue, time);
}