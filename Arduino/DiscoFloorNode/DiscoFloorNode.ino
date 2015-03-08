/*
  See README for description and pin assignment
*/

// #include <HardwareSerial_RS485.h>
#include <SoftwareSerial.h>
#include <LEDFader.h>
#include "MessageBuffer.h"
#include "TestMaster.h"
#include "Constants.h"

uint8_t myAddress  = 0;
boolean needsAck   = false;      // TRUE if we're waiting for an ACK

// The RGB LEDs
LEDFader rgb[3] = { LEDFader(LED_RED), 
                    LEDFader(LED_GREEN), 
                    LEDFader(LED_BLUE) };

MessageBuffer txBuffer(TX_CONTROL);
MessageBuffer rxBuffer(TX_CONTROL);

SoftwareSerial debugSerial(SSERIAL_DEBUG_RX, SSERIAL_DEBUG_TX);
TestMaster     dummyMaster(&rxBuffer, &txBuffer, &debugSerial);

bool enabledState = false, // is the node enabled
     isMaster     = false; // is this mode the dumy master

void setup() {
  pinMode(NODE_STATUS, OUTPUT);
  pinMode(NEXT_NODE,   OUTPUT);  
  pinMode(TX_CONTROL,  OUTPUT);
  pinMode(ENABLE_NODE, INPUT);
  
  digitalWrite(TX_CONTROL, RS485Receive);
  
  // Init serial communication
  Serial.begin(9600);
  debugSerial.begin(9600);

  // This is the master node
  pinMode(ENABLE_MASTER, INPUT);
  isMaster = (digitalRead(ENABLE_MASTER) == HIGH);
  if (isMaster) {
    dummyMaster.setup();
  } 
  else {
    delay(1000);
    digitalWrite(NODE_STATUS, HIGH);
    debugSerial.println(F("I'm a node."));
  }
}

void loop() {
  long now = millis();

  // Skip to TestMater loop
  if (isMaster) {
    dummyMaster.loop();
    return;
  } 

  // Update non-blocking LED fade
  updateLEDs();

  // Process message received from the bus
  rxBuffer.read();
  if (rxBuffer.isReady()) {
    processMessage();
  }

  // Resend message
  // if (needsAck && now > txBuffer.sentAt + ACK_TIMEOUT) {
  //   debugSerial.println(F("Resend message"));
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
  debugSerial.println(F("Received ACK"));
  needsAck = false;

  // Address set, tell next node to set address
  if (txBuffer.type == TYPE_ADDR) {
    debugSerial.println(F("Address next node (ACKED)"));
    digitalWrite(NEXT_NODE, HIGH);
  }
}

// Process messages addressed to me
void myMessage() {
  // debugSerial.println(F("Received message"));

  switch(rxBuffer.type) {
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
        debugSerial.println(F("Send Status (direct address)"));
        sendStatus();
      } else if (rxBuffer.getLowerDestRange() < myAddress){
        debugSerial.println(F("Status: Not my turn yet"));
      }
    break;
    case TYPE_ADDR:
      // If master reports our address, enable the next node (in case we didn't hear the ACK)
      if (txBuffer.type == TYPE_ADDR && needsAck == true && rxBuffer.getBody()[0] == myAddress) {
        debugSerial.println(F("Address next node (observed)"));
        needsAck = false;
        digitalWrite(NEXT_NODE, HIGH);
      }
    break;
  }
}

// Observe any messages are going to master
void masterMessage() {

  switch(rxBuffer.type) {

    // If the previous node sent it's status to mater, send ours next.
    case TYPE_STATUS:
      debugSerial.print(F("Observed status sent to master for "));
      debugSerial.println(rxBuffer.getSourceAddress());
      if (rxBuffer.getSourceAddress() + 1 == myAddress) {
        debugSerial.println(F("Send Status (from queue)"));
        sendStatus();
      }
    break;
  }
}

// Send node status to master
void sendStatus() {
  uint8_t flag = 0;

  // Define cell flags
  if (isFading()) {
    flag |= FADING;
  }

  txBuffer.start(TYPE_STATUS);
  txBuffer.setDestAddress(MASTER_ADDRESS);
  txBuffer.write(flag);
  txBuffer.write(rgb[0].get_value());
  txBuffer.write(rgb[1].get_value());
  txBuffer.write(rgb[2].get_value());
  txBuffer.send();
}

// Set the LED color
void handleColorMessage() {
  debugSerial.println(F("Set color!"));

  uint8_t *colors = rxBuffer.getBody();

  // Invalid color
  if (rxBuffer.getBodyLen() != 3) {
    debugSerial.print("Invalid fade command length: ");
    debugSerial.println(rxBuffer.getBodyLen());
    return;
  }

  // Set colors
  setColor(colors[0], colors[1], colors[2]);

  // Debug
  debugSerial.print(colors[0]); debugSerial.print(F(","));
  debugSerial.print(colors[1]); debugSerial.print(F(",")); 
  debugSerial.print(colors[2]);
  debugSerial.print(F("\n"));
}

// Set LED fade
void handleFadeMessage() {
  debugSerial.println(F("Set fade!"));

  uint8_t *data = rxBuffer.getBody();
  uint8_t len = rxBuffer.getBodyLen();
  int duration;

  // Invalid message
  if (len < 4) {
    debugSerial.print("Invalid fade command length: ");
    debugSerial.println(len);
    return;
  }

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

  // Debug
  debugSerial.print(data[0]); debugSerial.print(F(","));
  debugSerial.print(data[1]); debugSerial.print(F(",")); 
  debugSerial.print(data[2]); debugSerial.print(F(" in ")); 
  debugSerial.print(duration); debugSerial.print(F("ms\n")); 
}


// Set an address if one hasn't been defined yet
void setAddress() {
  int enabled = digitalRead(ENABLE_NODE);

  // debugSerial.println(F("Set address"));
  // if (enabled != HIGH) debugSerial.println(F("Node not enabled"));
  // if (rxBuffer.type != TYPE_ADDR) debugSerial.println(F("Not setting address"));

  // Just enabled, clear RX and wait for next address (in case current RX is stale)
  if (enabled == HIGH && enabledState == false) {
    rxBuffer.reset();
    enabledState = true;
  }

  // Set address
  else if (enabled == HIGH && rxBuffer.type == TYPE_ADDR) {
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

      debugSerial.print(F("My address is: "));
      debugSerial.println(myAddress);

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

void printMsgState(uint8_t state) {
  debugSerial.print(state, HEX);
  debugSerial.print(F(": "));
  switch(state) {
    case MSG_STATE_IDL:
      debugSerial.println(F("IDL"));
    break;
    case MSG_STATE_HDR:
      debugSerial.println(F("HDR"));
    break;
    case MSG_STATE_ACT:
      debugSerial.println(F("ACT"));
    break;
    case MSG_STATE_IGN:
      debugSerial.println(F("IGN"));
    break;
    case MSG_STATE_RDY:
      debugSerial.println(F("RDY"));
    break;
    case MSG_STATE_ABT:
      debugSerial.println(F("ABT"));
    break;
    default:
      debugSerial.println(F("OTHER"));
  }
  delay(500);
}