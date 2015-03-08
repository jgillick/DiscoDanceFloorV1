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

#define ADDRESSING_TIMEOUT  5000
#define PROGRAM_TIMEOUT     10000
#define PROGRAM_NUM         3

// Program stages
#define IDLE                0x00
#define ADDRESSING          0x01
#define GET_STATUS          0x02
#define RUN_PROGRAM         0x03

class TestMaster {
private:

  uint8_t  stage,
           myAddress,
           firstNodeAddress,
           lastNodeAddress,
           currentProgram,
           lastStatusAddr,
           statusTries;
  long     programTime,
           lastAddrRXTime,
           lastStatusTXTime;

  uint8_t  prog0lastLED;

  MessageBuffer  *txBuffer;
  MessageBuffer  *rxBuffer;
  SoftwareSerial *debugSerial;

  void processMessage();
  void addressing(long);
  void sendAddress();
  void sendACK(uint8_t);
  void goIdle();
  void nextStage();

  void getNodeStatus(long);
  void sendStatusRequest(long);

  void runPrograms(long);
  void programSameColor(long);
  void programDiffColors(long);
  void programFadeColors(long);

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