
#include "MultidropSlave.h"
#include <util/crc16.h>

#define SOM 0xFF

MultidropSlave::MultidropSlave(MultidropData *_serial) : Multidrop(_serial) {
  flags = 0;
  myAddress = 0;
  responseHandler = 0;
  parseState = NO_MESSAGE;
}

void MultidropSlave::reset() {
  address = 0;
  setNextDaisyValue(0);
}

uint8_t MultidropSlave::hasNewMessage() {
  return parseState == MESSAGE_READY;
}

uint8_t MultidropSlave::isAddressedToMe() {
  return hasNewMessage() && (address == myAddress || address == BROADCAST_ADDRESS);
}

uint8_t MultidropSlave::inBatchMode() {
  return flags & BATCH_FLAG;
}

uint8_t MultidropSlave::isResponseMessage() {
  return flags & RESPONSE_MESSAGE_FLAG;
}

uint8_t* MultidropSlave::getData() {
  return dataBuffer;
}

uint8_t MultidropSlave::getDataLen() {
  return dataIndex;
}

uint8_t MultidropSlave::getCommand() {
  return command;
}

void MultidropSlave::setAddress(uint8_t addr) {
  myAddress = addr;
}

void MultidropSlave::setResponseHandler(multidropResponseFunction handler) {
  responseHandler = handler;
}

void MultidropSlave::startMessage() {
  flags = 0;
  length = 0;
  address = 0;
  lastAddr = 0xFF;
  dataIndex = 0;
  dataBuffer[0] = '\0';
  fullDataLength = 0;
  fullDataIndex = 0;
  dataStartOffset = 0;

  messageCRC = ~0;
  messageCRC = _crc16_update(messageCRC, SOM);
  messageCRC = _crc16_update(messageCRC, SOM);
}

uint8_t MultidropSlave::read() {
  checkDaisyChainPolarity();

  // Move onto the next message
  if (parseState == MESSAGE_READY) {
    parseState = NO_MESSAGE;
  }

  // No new data, but our prev daisy line just went high
  if (command == CMD_ADDRESS && parsePos == ADDR_UNSET && isPrevDaisyEnabled() && !serial->available()){
    processAddressing(lastAddr);
  }

  // Handle incoming bytes
  while (serial->available()) {
    if(parse(serial->read()) == 1 && !isResponseMessage()) {

      if (command == CMD_RESET) {
        reset();
      }

      return 1;
    }
  }
  return 0;
}

uint8_t MultidropSlave::parse(uint8_t b) {

  if (parseState == HEADER_SECTION) {
    parseHeader(b);
  }
  else if (parseState == DATA_SECTION) {
    if (command == CMD_ADDRESS) {
      processAddressing(b);
    } else {
      processData(b);
    }
  }
  // Validate CRC
  else if (parseState == END_SECTION) {
    uint8_t crcByte;

    if (parsePos == DATA_POS) { // First byte
      crcByte = (messageCRC >> 8) & 0xFF;
      parsePos = EOM1_POS;
    }
    else { // Second byte
      crcByte = messageCRC & 0xff;
      parsePos = EOM2_POS;
    }

    // Validate each byte
    if (crcByte != b) {
      parseState = NO_MESSAGE; // no match, abort
    }
    else if (parsePos == EOM2_POS) {
      parseState = MESSAGE_READY;
      return 1;
    }
  }
  // Second start byte
  else if (parseState == START_SECTION) {
    if (b == SOM) {
      startMessage();
      parsePos = SOM2_POS;
      parseState = HEADER_SECTION;
    }
    // No second 0xFF, so invalid start to message
    else {
      parseState = NO_MESSAGE;
    }
  }
  // First start byte
  else if (parseState == NO_MESSAGE && b == SOM) {
    parsePos = SOM1_POS;
    parseState = START_SECTION;
  }

  return 0;
}

void MultidropSlave::parseHeader(uint8_t b) {
  messageCRC = _crc16_update(messageCRC, b);

  // Header flags
  if (parsePos == SOM2_POS) {
    parsePos = HEADER_FLAGS_POS;
    flags = b;
  }
  // Address
  else if (parsePos == HEADER_FLAGS_POS) {
    parsePos = HEADER_ADDR_POS;
    address = b;
  }
  // Command
  else if (parsePos == HEADER_ADDR_POS) {
    parsePos = HEADER_CMD_POS;
    command = b;
  }
  // Length, 1st byte
  else if (parsePos == HEADER_CMD_POS) {
    parsePos = HEADER_LEN1_POS;

    // in batch mode, the first length byte is the number of nodes
    if (inBatchMode()) {
      numNodes = b;
    } else {
      length = b;
      fullDataLength = b;
      dataStartOffset = 0;
      parseState = DATA_SECTION;
    }
  }
  // Length, 2nd byte (if in batch mode)
  else if (parsePos == HEADER_LEN1_POS) {
    length = b;
    fullDataLength = length * numNodes;
    dataStartOffset = myAddress-1 * length; // Where our data starts in the message

    parsePos = HEADER_LEN2_POS;
    parseState = DATA_SECTION;
  }

  // Finishing header
  if (parseState == DATA_SECTION) {

    // On to addressing
    if (command == CMD_ADDRESS) {
      parsePos = ADDR_WAITING;
    }

    // No data, continue to CRC
    else if (length == 0) {
      parseState = END_SECTION;
    }

    // If in response message and we're the first node, move straight to sending a response
    else if (isResponseMessage() && myAddress == 1) {
      sendResponse();
    }
  }
}

void MultidropSlave::processData(uint8_t b) {
  messageCRC = _crc16_update(messageCRC, b);
  parsePos = DATA_POS;

  // Provide a response to fill our data section
  if (isResponseMessage() && fullDataIndex == dataStartOffset) {
    sendResponse();
    return;
  }

  // If we're in our data section, fill data buffer
  else if (fullDataIndex >= dataStartOffset && dataIndex < length){
    dataBuffer[dataIndex++] = b;
    dataBuffer[dataIndex] = '\0';
  }

  fullDataIndex++;

  // Done with data
  if (fullDataIndex >= fullDataLength) {
    parseState = END_SECTION;
  }
}


void MultidropSlave::processAddressing(uint8_t b) {

  // We still waiting for an address
  if (myAddress == 0 && isPrevDaisyEnabled() && !serial->available()){

    // Address confirmation
    if (parsePos == ADDR_SENT) {
      if (b == lastAddr) {
        parsePos = ADDR_CONFIRMED;
        myAddress = b;
        setNextDaisyValue(1);

        // Max address is 0xFF
        if (b == 0xFF) {
          doneAddressing();
        }
        return;
      }
      // Not confirmed, try again
      else {
        parsePos = ADDR_UNSET;
        lastAddr = b;
        return;
      }
    }
    // This might be ours, send tentative new address and wait for confirmation
    else if(b >= lastAddr) {
      b++;
      parsePos = ADDR_SENT;
      serial->enable_write();
      serial->write(b);
      serial->enable_read();
      lastAddr = b;
      return;
    }
  }

  // Done when we see two 0xFF
  if (parsePos != ADDR_SENT && lastAddr == b && b == 0xFF) {
    doneAddressing();
  }

  lastAddr = b;

  if (parsePos == ADDR_WAITING) {
    parsePos = ADDR_UNSET;
  }
}

void MultidropSlave::doneAddressing() {
  dataIndex = 0;
  dataBuffer[dataIndex++] = myAddress;
  dataBuffer[dataIndex] = '\0';
  parseState = MESSAGE_READY;
}

void MultidropSlave::sendResponse() {
  if (responseHandler) {
    uint8_t i;
    responseHandler(command, dataBuffer, length);

    // Write response buffer to stream
    serial->enable_write();
    for (i = 0; i < length; i++) {
      serial->write(dataBuffer[i]);
      messageCRC = _crc16_update(messageCRC, dataBuffer[i]);
      fullDataIndex++;
    }
    serial->enable_read();
  }
}
