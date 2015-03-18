/*
  See README for description and pin assignment
*/

#include "LEDFader.h"
#include "CapacitiveSensor.h"
#include "MessageBuffer.h"
#include "Constants.h"

#ifdef DUMMY_MASTER
#include <SoftwareSerial.h>
#include "TestMaster.h"
#endif

// long lastPing = 0;
uint8_t myAddress       = 0;
boolean needsAck        = false, // TRUE if we're waiting for an ACK
        enabledState    = false, // is the node enabled
        isMaster        = false, // is this mode the dumy master
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
#ifdef DUMMY_MASTER
SoftwareSerial debugSerial(SSERIAL_DEBUG_RX, SSERIAL_DEBUG_TX);
TestMaster     dummyMaster(&rxBuffer, &txBuffer, &debugSerial);
#endif

void setup() {
  pinMode(NEXT_NODE,   OUTPUT);
  pinMode(TX_CONTROL,  OUTPUT);
  pinMode(NODE_STATUS, OUTPUT);
  pinMode(ENABLE_NODE, INPUT);

  digitalWrite(TX_CONTROL, RS485Receive);

  // Init serial communication
  Serial.begin(57600);

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

void reset() {
  myAddress = 0;
  txBuffer.setMyAddress(0);
  rxBuffer.setMyAddress(0);
  txBuffer.reset();
  rxBuffer.reset();
  digitalWrite(NEXT_NODE, LOW);
}

void loop() {
  long now = millis();

  // Send deubbging ping
  // if (lastPing + 1000 < now) {
  //   Serial.print("PING");
  //   lastPing = now;
  // }

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
    digitalWrite(NEXT_NODE, HIGH);
  }
}

// Process messages addressed to me
void myMessage() {

  switch(rxBuffer.getType()) {
    case TYPE_RESET:
      reset();
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
      if (rxBuffer.getLowerDestRange() == myAddress) {
        // Serial.println(F("Send Status (direct address)"));
        sendStatus();
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
          digitalWrite(NEXT_NODE, HIGH);
        }
      }
    break;
  }
}

// Observe any messages are going to master
void masterMessage() {

  switch(rxBuffer.getType()) {

    case TYPE_STATUS:
      // Preload sensor value (since we're up soon and the call is blocking)
      if (rxBuffer.getSourceAddress() < myAddress && !gotSensorValue) {
        lastSensorValue = sensorValue();
        gotSensorValue = true;
      }

      // If the previous node sent it's status to mater, send ours next.
      if (rxBuffer.getSourceAddress() + 1 == myAddress) {
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
  return (sensor.capacitiveSensor(30) >= 100);
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
  int enabled = digitalRead(ENABLE_NODE);

  // Just enabled, clear RX and wait for next address (in case current RX is stale)
  if (enabled == HIGH && enabledState == false) {
    rxBuffer.reset();
    enabledState = true;
  }

  // Set address
  else if (enabled == HIGH && rxBuffer.getType() == TYPE_ADDR) {
    uint8_t addr = (uint8_t)rxBuffer.getBody()[0];

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

// void printMsgState(uint8_t state) {
//   Serial.print(state, HEX);
//   Serial.print(F(": "));
//   switch(state) {
//     case MSG_STATE_IDL:
//       Serial.println(F("IDL"));
//     break;
//     case MSG_STATE_HDR:
//       Serial.println(F("HDR"));
//     break;
//     case MSG_STATE_ACT:
//       Serial.println(F("ACT"));
//     break;
//     case MSG_STATE_IGN:
//       Serial.println(F("IGN"));
//     break;
//     case MSG_STATE_RDY:
//       Serial.println(F("RDY"));
//     break;
//     case MSG_STATE_ABT:
//       Serial.println(F("ABT"));
//     break;
//     default:
//       Serial.println(F("OTHER"));
//   }
//   delay(500);
// }