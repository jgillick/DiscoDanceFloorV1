
#include "MessageBuffer.h"

MessageBuffer::MessageBuffer(uint8_t txCntl) {
  myAddress = 0;
  txControl = txCntl;
  reset();
}

void MessageBuffer::start(uint8_t messageType) {
  type = messageType;

  if (type == 0) {
    messageState = MSG_STATE_IDL;
  } else {
    messageState = MSG_STATE_ACT;
    receiveTimeout = millis() + RECEIVE_TIMEOUT;
  }

  sentAt = 0;
  escaped = false;
  bufferPos = 0;
  headerPos = 0;

  srcAddress = 0;
  addressDestRange[0] = 0;
  addressDestRange[1] = 0;
}
void MessageBuffer::reset() {
  start(0);
}

uint8_t MessageBuffer::getType() {
  return type;
}

uint8_t MessageBuffer::getState() {
  return messageState;
}

void MessageBuffer::setMyAddress(uint8_t addr) {
  myAddress = addr;
}

uint8_t MessageBuffer::getSourceAddress() {
  return srcAddress;
}

void MessageBuffer::setDestAddress(uint8_t start, uint8_t end) {
  messageState = MSG_STATE_ACT;
  addressDestRange[0] = start;
  addressDestRange[1] = end;
}
void MessageBuffer::setDestAddress(uint8_t addr) {
  setDestAddress(addr, addr);
}

uint8_t MessageBuffer::getLowerDestRange() {
  return addressDestRange[0];
}

uint8_t MessageBuffer::getUpperDestRange() {
  return addressDestRange[1];
}

bool MessageBuffer::addressedToMe() {

  // Wildcard
  if (addressDestRange[0] == MSG_ALL) return true;

  // We have not set our address
  if (myAddress == 0) return false;

  // Match range
  if (addressDestRange[1] == MSG_ALL && addressDestRange[0] <= myAddress) return true;
  if (addressDestRange[0] <= myAddress && addressDestRange[1] >= myAddress) return true;

  return false;
}

bool MessageBuffer::addressedToMaster() {
  return addressDestRange[0] == MASTER_ADDRESS;
}

bool MessageBuffer::isReady() {
  return messageState == MSG_STATE_RDY;
}

uint8_t* MessageBuffer::getBody() {
  return buffer;
}

int MessageBuffer::getBodyLen() {
  return bufferPos;
}

uint8_t MessageBuffer::write(uint8_t* buf, uint8_t len) {
  for(int i = 0; i < len; i++) {
    write(buf[i]);
  }
  return messageState;
}

uint8_t MessageBuffer::write(uint8_t c) {
  if (messageState >= MSG_STATE_RDY) return messageState;

  // Buffer over flow
  if (bufferPos + 1 >= MSG_BUFFER_LEN) {
    return messageState = MSG_STATE_BOF;
  }

  buffer[bufferPos++] = c;
  buffer[bufferPos]   = '\0'; // Null terminator

  return messageState;
}

uint8_t MessageBuffer::processHeader(uint8_t c) {
  if (messageState != MSG_STATE_HDR) return messageState;

  // Headder parts
  switch (headerPos){

    // Lower Destination
    case 0:
      addressDestRange[0] = c;
    break;
    // Upper Destination
    case 1:
      addressDestRange[1] = c;
    break;
    // Source address
    case 2:
      srcAddress = c;
    break;
    // Message type
    case 3:
      type = c;
    break;

  }
  headerPos++;

  // Move onto the body of the message
  if (headerPos >= 4) {
    return messageState = MSG_STATE_ACT;
  }
  return messageState;
}

uint8_t MessageBuffer::parse(uint8_t c) {
  long now = millis();

  // Previous message timeout
  if (receiveTimeout < now) {
    reset();
  }

  // Escape characer
  if (escaped) {
    escaped = false;
    if (messageState == MSG_STATE_ACT) {
      return write(c);
    }
    else if (messageState == MSG_STATE_HDR) {
      return processHeader(c);
    }
  }

  // Start of message
  else if(c == MSG_SOM) {
    reset();
    receiveTimeout = now + RECEIVE_TIMEOUT;
    messageState = MSG_STATE_HDR;
  }

  // Aborted or overflow, wait until we see a new message
  else if (messageState >= MSG_STATE_RDY) {
    return messageState;
  }

  // Header
  else if (messageState == MSG_STATE_HDR) {
    return processHeader(c);
  }

  // End of message
  else if (c == MSG_EOM) {
    if(messageState == MSG_STATE_ACT && bufferPos > 0) {

      // Compare checksum
      uint8_t checksum = buffer[--bufferPos];
      buffer[bufferPos] = '\0';
      if (calculateChecksum() != checksum) {
        // Serial.print(F("D:"));
        // Serial.write(addressDestRange[0]);Serial.write(',');
        // Serial.write(addressDestRange[1]);Serial.write(',');
        // Serial.write(srcAddress);Serial.write(',');
        // Serial.write(type);
        // Serial.write(':');
        // for(int i = 0; i < bufferPos; i++ ){
        //   Serial.write(buffer[i]);Serial.write(',');
        // }
        Serial.print(F("CM!"));
        Serial.write(checksum); Serial.write('!'); Serial.write(calculateChecksum());

        return messageState = MSG_STATE_ABT;
      }

      return messageState = MSG_STATE_RDY;
    } else {
      reset();
    }
  }

  // Message body
  else if(messageState == MSG_STATE_ACT) {
    if (c == MSG_ESC) {
      escaped = true;
    } else {
      return write(c);
    }
  }

  return messageState;
}

uint8_t MessageBuffer::read() {
  digitalWrite(txControl, RS485Receive);
  while (Serial.available() > 0) {
    parse((uint8_t)Serial.read());
  }
  return messageState;
}


// Calculate the checksum for this message
uint8_t MessageBuffer::calculateChecksum() {
  uint8_t checksum = 0;
  if (messageState != MSG_STATE_RDY && messageState != MSG_STATE_ACT) return 0;

  checksum = crc_checksum(checksum, addressDestRange[0]);
  checksum = crc_checksum(checksum, addressDestRange[1]);
  checksum = crc_checksum(checksum, srcAddress);
  checksum = crc_checksum(checksum, type);
  for(int i = 0; i < bufferPos; i++ ){
    checksum = crc_checksum(checksum, buffer[i]);
  }

  return checksum;
}

void MessageBuffer::sendChar(uint8_t c) {

  // Escape
  if (c == MSG_SOM || c == MSG_EOM || c == MSG_ESC) {
    Serial.write(MSG_ESC);
  }

  Serial.write(c);
}

void MessageBuffer::send() {
  if (messageState != MSG_STATE_RDY && messageState != MSG_STATE_ACT) return;
  if (myAddress == 0) return;

  // Start sending
  srcAddress = myAddress;
  digitalWrite(txControl, RS485Transmit);

  Serial.print(MSG_SOM);

  // Headers
  sendChar(addressDestRange[0]);
  sendChar(addressDestRange[1]);
  sendChar(srcAddress);
  sendChar(type);

  // Add message body and escape reserved bytes
  for(int i = 0; i < bufferPos; i++ ){
    sendChar(buffer[i]);
  }

  // End of messageState
  sendChar(calculateChecksum());
  Serial.print(MSG_EOM);
  Serial.flush();
  sentAt = millis();

  // Set back to receive
  digitalWrite(txControl, RS485Receive);
}

uint8_t MessageBuffer::crc_checksum(uint8_t crc, uint8_t data) {
  // From http://www.nongnu.org/avr-libc/user-manual/group__util__crc.html#ga37b2f691ebbd917e36e40b096f78d996
  uint8_t i;
  crc = crc ^ data;
  for (i = 0; i < 8; i++) {
    if (crc & 0x01)
      crc = (crc >> 1) ^ 0x8C;
    else
      crc >>= 1;
  }
  return crc;
}
