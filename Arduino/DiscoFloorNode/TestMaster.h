/*
  A dummy master program to be run on another arduino.
  This will run a few test progams after successfully 
  registering all floor nodes.

  Wiring for this should be the same as any other node, except
  pull pin 5 high, to tell this arduino that it is master.
*/

#ifndef TestMaster_H_
#define TestMaster_H_

#include <Arduino.h>
#include <SoftwareSerial.h>
#include "MessageBuffer.h"
#include "Constants.h"

#define ADDRESSING_TIMEOUT  10000
#define PROGRAM_TIMEOUT     5000
#define PROGRAM_MAX         1

class TestMaster {
private:

  bool     isAddressing;
  uint8_t  myAddress,
           lastNodeAddress,
           currentProgram;
  long     programTime,
           lastAddrRXTime;

  uint8_t  prog0lastLED;

  MessageBuffer  *txBuffer;
  MessageBuffer  *rxBuffer;
  SoftwareSerial *debugSerial;

  void processMessage();
  void sendAddress();
  void sendACK(uint8_t addr);

  void programSameColor();
  void programDiffColors();

  uint8_t wrap(uint8_t val, uint8_t max) {
    if (val > max) return 0;
    return val;
  }
public:
  TestMaster(MessageBuffer *rx, MessageBuffer *tx, SoftwareSerial *serial);
  void setup();
  void loop();
};


#endif TestMaster_H_