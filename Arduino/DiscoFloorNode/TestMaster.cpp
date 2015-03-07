#include "TestMaster.h"

TestMaster::TestMaster(MessageBuffer *rx, MessageBuffer *tx, SoftwareSerial *serial) {
  rxBuffer = rx;
  txBuffer = tx;
  debugSerial = serial;

  myAddress        = 1;
  isAddressing     = true;
  programTime      = 0;
  currentProgram   = 0;
  lastAddrRXTime   = millis();

  prog0lastLED     = 0;
}

void TestMaster::setup() {
  Serial.println("I'm the master, bitch!");

  myAddress       = MASTER_ADDRESS;
  lastNodeAddress = myAddress;
  txBuffer->setMyAddress(myAddress);
  rxBuffer->setMyAddress(myAddress);

  // Enable first floor node
  digitalWrite(NEXT_NODE, HIGH);
  delay(100);
  sendAddress();
  lastAddrRXTime = millis();
}

void TestMaster::loop() {
  long now = millis();

  // Print Debug
  if (debugSerial->available()) {
    char c;
    delay(100);
    Serial.print("#: ");
    while(debugSerial->available()) {
      if (c == '\n') {
        Serial.print("#: ");
      }
      c = debugSerial->read();
      Serial.print(c);
    }
    if (c != '\n') Serial.print("\n");
  }

  // Done waiting for addresses
  if (isAddressing && lastAddrRXTime > 0 && lastAddrRXTime + ADDRESSING_TIMEOUT < now) {
    Serial.println("Done addressing");
    Serial.print(lastNodeAddress - myAddress);
    Serial.println(" node(s) found");
    isAddressing = false; 

    if (lastNodeAddress == myAddress) {
      Serial.println("No nodes detected");
    }
  }

  // Message received from the bus
  if (rxBuffer->read() == MSG_STATE_RDY) {
    processMessage();
  }

  // Send last address
  if (isAddressing && txBuffer->sentAt > 0 && now > txBuffer->sentAt + ACK_TIMEOUT) {
    txBuffer->send();
  }

  // Run programs
  if (!isAddressing && lastNodeAddress > myAddress) {

    // Update program
    if (programTime + PROGRAM_TIMEOUT < now) {

      // First program to run
      if (programTime == 0) {
        Serial.print("Running program: ");
        Serial.println(currentProgram);
      }
      // Move to next program
      else {
        currentProgram = wrap(++currentProgram, PROGRAM_MAX);
        Serial.print("Update to program: ");
        Serial.println(currentProgram);
      } 

      programTime = millis();
      txBuffer->reset();
    }

    // Select program
    switch (currentProgram) {
      case 0:
        programSameColor();
      break;
      case 1:
        programDiffColors();
      break;
    }
  }
}

void TestMaster::sendAddress (){
  txBuffer->start();
  txBuffer->setDestAddress(MSG_ALL);
  txBuffer->type = TYPE_ADDR;
  txBuffer->write(lastNodeAddress);
  txBuffer->send();
}

void TestMaster::sendACK(uint8_t addr) {
  Serial.print("Sending ACK to node ");
  Serial.println(addr);
  delay(50);

  txBuffer->start();
  txBuffer->setDestAddress(addr);
  txBuffer->type = TYPE_ACK;
  txBuffer->write(myAddress);
  txBuffer->send();
}

void TestMaster::processMessage() {

  // Not addressed to me
  if (!rxBuffer->addressedToMe()) {
    rxBuffer->reset();
    return;
  }
    
  // Register Latest address
  if (rxBuffer->type == TYPE_ADDR) {
    uint8_t addr = (uint8_t)rxBuffer->getBody()[0];

    // New address must be bigger than the last registered address
    if (addr > lastNodeAddress) {
      Serial.print("Add node at address ");
      Serial.println(addr);
      lastNodeAddress = addr;
      sendACK(addr);
      delay(50);

      // Query for the next address
      sendAddress();
      lastAddrRXTime = millis();
    } 
    else {
      Serial.print("Invalid address: "); 
      Serial.print(addr);
      Serial.print(" < ");
      Serial.println(lastNodeAddress); 
    }
  }

  rxBuffer->reset();
}

void TestMaster::programSameColor() {
  long now = millis();

  // Change LED color
  if (txBuffer->sentAt + 1000 < now) {
    uint8_t color[3] = {0,0,0};
    color[prog0lastLED] = 1;

    Serial.print("Set Same LED ");
    Serial.println(prog0lastLED);

    txBuffer->start();
    txBuffer->setDestAddress(MSG_ALL);
    txBuffer->type = TYPE_COLOR;
    txBuffer->write(color, 3);
    txBuffer->send();

    // Update color index
    prog0lastLED = wrap(++prog0lastLED, 2);
  }
}

void TestMaster::programDiffColors() {
  long now = millis();

  // Shift colors
  if (txBuffer->sentAt + 250 < now) {
    uint8_t led = prog0lastLED++;
    uint8_t color[3] = {0,0,0};

    for (uint8_t i = myAddress + 1; i <= lastNodeAddress; i++) {
      color[0] = 0;
      color[1] = 0;
      color[2] = 0;
      color[led++] = 1;

      Serial.print("Set Different LEDs");
      Serial.println(prog0lastLED);

      txBuffer->start();
      txBuffer->setDestAddress(i);
      txBuffer->type = TYPE_COLOR;
      txBuffer->write(color, 3);
      txBuffer->send();

      // Update color index
      led = wrap(led, 2);
    }

    prog0lastLED = wrap(prog0lastLED, 2);
  }
}