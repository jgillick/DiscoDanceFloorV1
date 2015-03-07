/*
  See README for description and pin assignment
*/

// #include <HardwareSerial_RS485.h>
#include <SoftwareSerial.h>
#include "MessageBuffer.h"
#include "TestMaster.h"
#include "Constants.h"

uint8_t myAddress  = 0;
boolean needsAck   = false;      // TRUE if we're waiting for an ACK

int rgb[3]         = {LED_RED, 
                      LED_GREEN, 
                      LED_BLUE}; // The RGB pins

MessageBuffer txBuffer(TX_CONTROL);
MessageBuffer rxBuffer(TX_CONTROL);

SoftwareSerial debugSerial(SSERIAL_DEBUG_RX, SSERIAL_DEBUG_TX);
TestMaster     dummyMaster(&rxBuffer, &txBuffer, &debugSerial);

bool enabledState = false, // is the node enabled
     isMaster     = false; // is this mode the dumy master

void setup() {
  pinMode(rgb[0],  OUTPUT);
  pinMode(rgb[1],  OUTPUT);
  pinMode(rgb[2],  OUTPUT);

  pinMode(NEXT_NODE,   OUTPUT);  
  pinMode(TX_CONTROL,  OUTPUT); 
  pinMode(STATUS,      OUTPUT);
  pinMode(ENABLE_NODE, INPUT);
  
  digitalWrite(rgb[0], LOW);
  digitalWrite(rgb[1], LOW);
  digitalWrite(rgb[2], LOW);
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
    digitalWrite(STATUS, HIGH);
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
      setColor();
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
}

// Set the LED color
void setColor() {
  debugSerial.println(F("Set color!"));

  uint8_t *colors = rxBuffer.getBody();

  // Invalid color
  if (rxBuffer.getBodyLen() != 3) return;

  // Set colors
  for(int i = 0; i < 3; i++) {
    debugSerial.print(colors[i]);
    digitalWrite(rgb[i], colors[i]);
  }
  debugSerial.print(F("\n"));
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
      txBuffer.start();
      txBuffer.setDestAddress(MASTER_ADDRESS);
      txBuffer.type = TYPE_ADDR;
      txBuffer.write(myAddress);
      txBuffer.send();

      debugSerial.print(F("My address is: "));
      debugSerial.println(myAddress);

      needsAck = true;
    }
  }
}

void commSend() {
  digitalWrite(TX_CONTROL, RS485Transmit);
  // digitalWrite(RX_CONTROL, RS485Transmit);
  delay(10);
}

void commReceive() {
  digitalWrite(TX_CONTROL, RS485Receive);
  // digitalWrite(RX_CONTROL, RS485Receive); 
  delay(10);
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