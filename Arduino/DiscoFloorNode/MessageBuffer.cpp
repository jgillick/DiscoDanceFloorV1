
#include "MessageBuffer.h"
#include <util/crc16.h>

MessageBuffer::MessageBuffer(uint8_t txCntl, uint8_t rxCntl) {
  myAddress = 0;
  weAreMaster = 0;
  txControl = txCntl;
  rxControl = rxCntl;
  reset();
}

void MessageBuffer::start(uint8_t messageType) {
  bufferPos = 0;
  headerPos = 0;
  destAddress = myAddress;
  calculatedCRC = ~0;
  msgLengthCounter = 0;

  // The last message type determined that this message should be streamed
  if (type == TYPE_STREAMING) {
    streaming = 1;
  }
  else {
    streaming = 0;
    streamingValueSet = 0;
  }

  type = messageType;
  if (type == 0) {
    messageState = MSG_STATE_IDL;
  } else {
    messageState = MSG_STATE_BOD;
    msgLengthCounter++;
  }
}
void MessageBuffer::reset() {
  start(0);
  streaming = 0;
  streamingValueSet = 0;
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

uint8_t MessageBuffer::getAddress() {
  return destAddress;
}

uint8_t MessageBuffer::isStreaming() {
  return streaming;
}

void MessageBuffer::setStreamingValue(uint8_t val) {
  streamingValueSet = 1;
  streamingValue = val;
}

void MessageBuffer::setMaster() {
  weAreMaster = 1;
}

void MessageBuffer::setDestAddress(uint8_t addr) {
  if (weAreMaster) {
    destAddress = addr;
  }
}

bool MessageBuffer::addressedToMe() {

  // All messages heard by master are for master
  if (weAreMaster) return true;

  // Wildcard
  if (destAddress == BROADCAST_ADDRESS) return true;

  // We have not set our address
  if (myAddress == 0) return false;

  // Exact match
  if (destAddress == myAddress) return true;

  return false;
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
  calculatedCRC = _crc16_update(calculatedCRC, c);

  // Buffer over flow
  if (bufferPos + 1 >= MSG_BUFFER_LEN) {
    return messageState = MSG_STATE_BOF;
  }

  buffer[bufferPos++] = c;

  return messageState;
}

uint8_t MessageBuffer::parse(uint8_t c) {

  // Message CRC
  if (messageState == MSG_STATE_CRC) {
    messageCRC |= c;

    // Checksums don't match
    if (calculatedCRC != messageCRC) {
      return messageState = MSG_STATE_ABT;
    }

    // Set streaming bit for the next message
    else if (type == TYPE_STREAMING) {

      // Missing streaming type in body, invalid
      if (bufferPos == 0) {
        return messageState = MSG_STATE_ABT;
      }

      streaming = 1;
      type = buffer[0];
      streamingValueSet = 0;
    }
    else {
      streaming = 0;
    }

    return messageState = MSG_STATE_RDY;
  }

  // Message body
  else if (messageState == MSG_STATE_BOD) {

    // Something went wrong
    if (msgLengthCounter > msgLength) {
      return messageState = MSG_STATE_ABT;
    }
    // End of the message, match checksum
    else if (msgLength == msgLengthCounter) {

      // If this was a streaming message, we're not returning it anyways
      if (streaming) {
        return messageState = MSG_STATE_IDL;
      }

      messageCRC = (c << 8);
      return messageState = MSG_STATE_CRC;
    }
    else {
      msgLengthCounter++;
      write(c);
    }
    return messageState;
  }

  // Header
  else if (messageState == MSG_STATE_HDR) {
    calculatedCRC = _crc16_update(calculatedCRC, c);
    return processHeader(c);
  }

  // Start of message
  else if(c == MSG_SOM) {

    // This is the second start bit, begin message
    if (messageState == MSG_STATE_SOM) {
      messageState = MSG_STATE_HDR;
    }
    else {
      start(TYPE_NULL);
      messageState = MSG_STATE_SOM;
    }
    return messageState;
  }

  // Aborted or overflow, wait until we see a new message
  else if (messageState >= MSG_STATE_RDY) {
    return messageState;
  }

  return messageState;
}

uint8_t MessageBuffer::processHeader(uint8_t c) {
  // Message address
  if (headerPos == 0) {
    destAddress = c;

    // Not valid address
    if (myAddress && !addressedToMe()) {
      messageState = MSG_STATE_ABT;
    }
  }
  // Length
  else if (headerPos == 1) {
    msgLength = c;
  }
  // Type
  else if (headerPos == 2) {
    type = c;
    msgLengthCounter++;
    messageState = MSG_STATE_BOD;
  }
  headerPos++;
  return messageState;
}

uint8_t MessageBuffer::read() {
  digitalWrite(txControl, RS485Receive);
  digitalWrite(rxControl, RS485Receive);

  while (Serial.available() > 0) {
    parse((uint8_t)Serial.read());

    // Return current message if it is ready
    if (isReady()) {
      return messageState;
    }
  }

  // It's our turn to respond in a streaming message
  if (streaming && streamingValueSet && myAddress > 0 && msgLengthCounter == myAddress) {
    digitalWrite(txControl, RS485Transmit);
    digitalWrite(rxControl, RS485Transmit);

    Serial.write(streamingValue);
    msgLengthCounter++;
    calculatedCRC = _crc16_update(calculatedCRC, streamingValue);

    digitalWrite(txControl, RS485Receive);
    digitalWrite(rxControl, RS485Receive);
  }

  return messageState;
}

void MessageBuffer::sendAndChecksum(uint8_t c) {
  Serial.write(c);
  calculatedCRC = _crc16_update(calculatedCRC, c);
}

void MessageBuffer::send() {
  if (myAddress == 0 && !weAreMaster) return;

  // Start sending
  calculatedCRC = ~0;
  digitalWrite(txControl, RS485Transmit);
  digitalWrite(rxControl, RS485Transmit);

  Serial.write(MSG_SOM);
  Serial.write(MSG_SOM);

  // Header
  sendAndChecksum(destAddress);
  sendAndChecksum(bufferPos + 1);
  sendAndChecksum(type);

  // Message body
  for(int i = 0; i < bufferPos; i++ ){
    sendAndChecksum(buffer[i]);
  }

  // End of message
  Serial.write((calculatedCRC >> 8) & 0xFF);
  Serial.write(calculatedCRC & 0xff);
  Serial.flush();

  // Set back to receive
  digitalWrite(txControl, RS485Receive);
  digitalWrite(rxControl, RS485Receive);
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
