
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
  }

  sentAt = 0;
  escaped = false;
  bufferPos = 0;
  headerPos = 0;
  isNew = true;

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
  if (addressDestRange[1] == MSG_ALL && addressDestRange[0] >= myAddress) return true;
  if (addressDestRange[0] >= myAddress && addressDestRange[0] <= myAddress) return true;

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

uint8_t MessageBuffer::addToBuffer(uint8_t c) {
  if (messageState >= MSG_STATE_RDY) return messageState;

  buffer[bufferPos++] = c;
  buffer[bufferPos]   = '\0'; // Null terminator

  // Buffer over flow
  if (bufferPos == MSG_BUFFER_LEN - 1) {
    messageState = MSG_STATE_BOF;
  }
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

uint8_t MessageBuffer::write(uint8_t c) { 

  // Escape characer
  if (escaped) {
    escaped = false;
    if (messageState == MSG_STATE_ACT) {
      addToBuffer(c);
      return messageState;
    }
  }

  // Start of message
  else if(c == MSG_SOM) {
    reset();
    messageState = MSG_STATE_HDR;
  }

  // Aborted or overflow, wait until we see a new message
  else if (messageState >= MSG_STATE_RDY) {
    return messageState;
  }

  // End of message
  else if (c == MSG_EOM) {
    if(messageState == MSG_STATE_ACT) {
      isNew = true;

      // Compare checksum
      uint8_t checksum = buffer[--bufferPos];
      buffer[bufferPos] = '\0';
      if (calculateChecksum() != checksum) {
        Serial.print("D:");
        Serial.write(addressDestRange[0]);Serial.print(',');
        Serial.write(addressDestRange[1]);Serial.print(',');
        Serial.write(srcAddress);Serial.print(',');
        Serial.write(type);Serial.print('B:');
        for(int i = 0; i < bufferPos; i++ ){
          Serial.write(buffer[i]);Serial.print(',');
        }
        Serial.print(F("CHECKSUMS MISMATCH: "));
        Serial.write(checksum); Serial.print("!="); Serial.write(calculateChecksum());
        return messageState = MSG_STATE_ABT;
      }

      return messageState = MSG_STATE_RDY;
    } else {
      reset();
    }
  }

  // Header
  else if (messageState == MSG_STATE_HDR) {
    return processHeader(c);
  }

  // Message body
  else if(messageState == MSG_STATE_ACT) {
    if (c == MSG_ESC) {
      escaped = true;
    } else {
      return addToBuffer(c);
    }
  }

  return messageState;
}


// Calculate the checksum for this message
uint8_t MessageBuffer::calculateChecksum() {
  uint8_t checksum = 0;
  if (messageState != MSG_STATE_RDY && messageState != MSG_STATE_ACT) return 0;

  checksum = _crc_ibutton_update(checksum, addressDestRange[0]);
  checksum = _crc_ibutton_update(checksum, addressDestRange[1]);
  checksum = _crc_ibutton_update(checksum, srcAddress);
  checksum = _crc_ibutton_update(checksum, type);
  for(int i = 0; i < bufferPos; i++ ){
    checksum = _crc_ibutton_update(checksum, buffer[i]);
  }

  return checksum;
}

uint8_t MessageBuffer::write(uint8_t* buf, uint8_t len) {
  for(int i = 0; i < len; i++) {
    write(buf[i]);
  }
  return messageState;
}

uint8_t MessageBuffer::read() {
  digitalWrite(txControl, RS485Receive);
  while (Serial.available() > 0) {
    write((uint8_t)Serial.read());
  }
  return messageState; 
}

uint8_t MessageBuffer::send() {
  uint8_t sent = 0;

  if (messageState != MSG_STATE_RDY && messageState != MSG_STATE_ACT) return 0;
  if (myAddress == 0) return 0;

  // Start sending
  srcAddress = myAddress;
  digitalWrite(txControl, RS485Transmit);

  Serial.print(MSG_SOM); sent++;

  // Headers
  Serial.write(addressDestRange[0]); sent++;
  Serial.write(addressDestRange[1]); sent++;
  Serial.write(srcAddress);          sent++;
  Serial.write(type);                sent++;

  // Add message body and escape reserved bytes
  for(int i = 0; i < bufferPos; i++ ){
    if (buffer[i] == MSG_SOM || buffer[i] == MSG_EOM || buffer[i] == MSG_ESC) {
      Serial.write(MSG_ESC);  
    }
    Serial.write(buffer[i]);
  }
  sent += bufferPos - 1;

  // End of messageState
  Serial.write(calculateChecksum());
  Serial.print(MSG_EOM);
  sent += 2;
  Serial.flush();
  sentAt = millis();

  // Set back to receive
  digitalWrite(txControl, RS485Receive);

  return sent;
}
