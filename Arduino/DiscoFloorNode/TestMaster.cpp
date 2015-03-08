#include "TestMaster.h"

TestMaster::TestMaster(MessageBuffer *rx, MessageBuffer *tx, SoftwareSerial *serial) {
  stage       = ADDRESSING;
  rxBuffer    = rx;
  txBuffer    = tx;
  debugSerial = serial;

  myAddress        = 1;
  programTime      = 0;
  currentProgram   = 0;
  lastAddrRXTime   = millis();

  prog0lastLED     = 0;
}

void TestMaster::setup() {
  Serial.println(F("I'm the master, bitch!"));

  myAddress        = MASTER_ADDRESS;
  firstNodeAddress = 0;
  lastNodeAddress  = myAddress;
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
  rxBuffer->read();

  // Print Debug
  if (debugSerial->available()) {
    char c;
    delay(10);
    Serial.print(F("#: "));
    while(debugSerial->available()) {
      if (c == '\n') {
        Serial.print(F("#: "));
      }
      c = debugSerial->read();
      Serial.print(c);
    }
    if (c != '\n') Serial.print(F("\n"));
  }

  // Process stage
  switch(stage) {
    case ADDRESSING:
      addressing(now);
    break;
    case GET_STATUS:
      getNodeStatus(now);
    break;
    case RUN_PROGRAM:
      runPrograms(now);
    break;
  }

  // Reset last received message
  if (rxBuffer->getState() == MSG_STATE_RDY) {
    rxBuffer->reset();
  }
}

void TestMaster::addressing(long now) {
  uint8_t addr;

  // Register new address
  if (rxBuffer->getState() == MSG_STATE_RDY && rxBuffer->type == TYPE_ADDR) {
    addr = (uint8_t)rxBuffer->getBody()[0];

    // New address must be bigger than the last registered address
    if (addr > lastNodeAddress) {
      Serial.print(F("Add node at address "));
      Serial.println(addr);

      if (!firstNodeAddress) {
        firstNodeAddress = addr;
      }

      lastNodeAddress = addr;
      sendACK(addr);
      delay(50);

      // Query for the next address
      sendAddress();
      lastAddrRXTime = millis();
    } 
    else {
      Serial.print(F("Invalid address: ")); 
      Serial.print(addr);
      Serial.print(F(" < "));
      Serial.println(lastNodeAddress); 
    }
  }

  // Done waiting for addresses
  if (lastAddrRXTime > 0 && lastAddrRXTime + ADDRESSING_TIMEOUT < now) {
    Serial.println(F("Done addressing"));
    Serial.print(lastNodeAddress - myAddress);
    Serial.println(F(" node(s) found"));
    
    if (!firstNodeAddress) {
      Serial.println(F("No nodes detected"));
      goIdle();
    } else {
      nextStage();
    }
  }

  // Resend last address
  else if (txBuffer->sentAt > 0 && now > txBuffer->sentAt + ACK_TIMEOUT) {
    txBuffer->send();
  }
}

void TestMaster::sendAddress(){
  txBuffer->start(TYPE_ADDR);
  txBuffer->setDestAddress(MSG_ALL);
  txBuffer->write(lastNodeAddress);
  txBuffer->send();
}

void TestMaster::sendACK(uint8_t addr) {
  Serial.print(F("Sending ACK to node "));
  Serial.println(addr);

  txBuffer->start(TYPE_ACK);
  txBuffer->setDestAddress(addr);
  txBuffer->write(myAddress);
  txBuffer->send();
}

void TestMaster::goIdle() {
  stage = IDLE;
}

// Move to the next stage in the program (1. addressing -> 2. get status -> 3. run program -> (repeat 2 & 3))
void TestMaster::nextStage() {
  Serial.print(F("Move to next stage: "));

  switch(stage) {
    case ADDRESSING:
    case RUN_PROGRAM:
      statusTries = 0;
      lastStatusAddr = MASTER_ADDRESS;
      lastStatusTXTime = 0;
      txBuffer->reset();

      stage = GET_STATUS;
      Serial.println(F("GET NODE STATUS"));
    break;
    case GET_STATUS:
      stage = RUN_PROGRAM;
      Serial.println(F("RUN PROGRAMS"));
    break;
  }
}

void TestMaster::getNodeStatus(long now) {

  // All statuses received
  if (lastStatusAddr == lastNodeAddress) {
    Serial.println(F("Done getting status"));
    nextStage();
  }

  // Register status
  else if (rxBuffer->getState() == MSG_STATE_RDY && rxBuffer->type == TYPE_STATUS) {
    Serial.print(F("Got status from "));
    Serial.println(rxBuffer->getSourceAddress());

    if (rxBuffer->getSourceAddress() > lastStatusAddr) {
      statusTries = 0;
      lastStatusAddr = rxBuffer->getSourceAddress();
      lastStatusTXTime = now;
    } else {
      Serial.println(F("Invalid status address"));
    }
  }

  // Send request for status
  else if (now > lastStatusTXTime + ACK_TIMEOUT) {
    sendStatusRequest(now);
  }
}

void TestMaster::sendStatusRequest(long now) {

  // Try from the next node forward
  if (statusTries >= 2) {

    // We're out of nodes
    if (lastStatusAddr + 1 >= lastNodeAddress) {
      nextStage();
      return;
    }
    else {
      Serial.print(F("No status received from "));
      Serial.print(lastStatusAddr + 1);
      Serial.println(F(", moving on"));

      lastStatusAddr++;
      statusTries = 0;
    }
  }

  txBuffer->start(TYPE_STATUS);
  txBuffer->setDestAddress(lastStatusAddr + 1, '*');
  txBuffer->send();

  lastStatusTXTime = now;
  statusTries++;
}

void TestMaster::runPrograms(long now) {

  // Update program
  if (programTime + PROGRAM_TIMEOUT < now) {

    // First program to run
    if (programTime == 0) {
      Serial.print(F("Running program: "));
      Serial.println(currentProgram);
    }
    // Move to next program
    else {
      currentProgram = wrap(++currentProgram, PROGRAM_NUM - 1);
      Serial.print(F("Update to program: "));
      Serial.println(currentProgram);
    } 

    programTXTime = 0;
    programTime = millis();
  }

  // Select program
  switch (currentProgram) {
    case 0:
      programSameColor(now);
    break;
    case 1:
      programDiffColors(now);
    break;
    case 2:
      programFadeColors(now);
    break;
  }

  nextStage();
}

void TestMaster::programSameColor(long now) {

  // Change LED color
  if (programTXTime + 1000 < now) {
    uint8_t color[3] = {0,0,0};
    color[prog0lastLED] = 255;

    Serial.print(F("Set Same LED "));
    Serial.println(prog0lastLED);

    txBuffer->start(TYPE_COLOR);
    txBuffer->setDestAddress(MSG_ALL);
    txBuffer->write(color, 3);
    txBuffer->send();
    programTXTime = now;

    // Update color index
    prog0lastLED = wrap(++prog0lastLED, 2);
  }
}

void TestMaster::programDiffColors(long now) {

  // Shift colors
  if (programTXTime + 250 < now) {
    uint8_t led = prog0lastLED++;
    uint8_t color[3] = {0,0,0};

    for (uint8_t i = myAddress + 1; i <= lastNodeAddress; i++) {
      color[0] = 0;
      color[1] = 0;
      color[2] = 0;
      color[led++] = 255;

      Serial.print(F("Set Different LEDs"));
      Serial.println(prog0lastLED);

      txBuffer->start(TYPE_COLOR);
      txBuffer->setDestAddress(i);
      txBuffer->write(color, 3);
      txBuffer->send();
      programTXTime = now;

      // Update color index
      led = wrap(led, 2);
    }

    prog0lastLED = wrap(prog0lastLED, 2);
  }
}

void TestMaster::programFadeColors(long now) {
  uint8_t data[4] = {0,0,0,4}; // duration is ms divided by 250 (4 == 1000ms)
  int maxValue = 120,
      rgbSelect;

  // Change colors
  if (programTXTime + 1000 < now) {

    for (uint8_t i = myAddress + 1; i <= lastNodeAddress; i++) {
      data[0] = 0;
      data[1] = 0;
      data[2] = 0;
      
      // Set a two colors to fade to 
      // (first can go from 0 - 120, secondary can go from 0 - 255)
      for (int c = 0; c < 2; c++) {
        rgbSelect = random(0, 3); // Which RGB color to set
        if (c == 1) maxValue =  255;
        data[rgbSelect] = random(0, maxValue);
      }

      Serial.print(F("Send Fade to "));
      Serial.print(i); Serial.print(F(": "));
      Serial.print(data[0]); Serial.print(F(","));
      Serial.print(data[1]); Serial.print(F(",")); 
      Serial.print(data[2]); 
      Serial.println(F(" in 1000ms")); 

      txBuffer->start(TYPE_FADE);
      txBuffer->setDestAddress(i);
      txBuffer->write(data, 4);
      txBuffer->send();
    }

    programTXTime = now;
  }
}