
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
  secondaryType = 0;
  bufferPos = 0;
  headerPos = 0;
  destAddress = myAddress;
  calculatedCRC = ~0;
  msgLengthCounter = 0;
  batchMsgCounter = 0;

  // The last message type determined that this message should be streamed
  if (messageState == MSG_STATE_STM) {
    streaming = 1;
  }
  else {
    streaming = 0;
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

bool MessageBuffer::isReady() {
  return messageState == MSG_STATE_RDY;
}

bool MessageBuffer::isStreaming() {
  return (streaming && messageState < MSG_STATE_IGN);
}

void MessageBuffer::setStreamingValue(uint8_t val) {
  streamingValue = val;
  streamingValueSet = 1;
}

bool MessageBuffer::isStreamingValueSet() {
  return (streamingValueSet == 1);
}

uint8_t MessageBuffer::getStreamingValue() {
  return streamingValue;
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

  // Broadcast address
  else if (destAddress == BROADCAST_ADDRESS) return true;

  // We have not set our address
  else if (myAddress == 0) return false;

  // Exact match
  else if (destAddress == myAddress) return true;

  return false;
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

  // Current message is being ignored or aborted, wait until we've read past message and CRC
  if (messageState >= MSG_STATE_IGN && msgLengthCounter < msgLength + 2) {
    msgLengthCounter++;
    return messageState;
  }

  // Message CRC
  else if (messageState == MSG_STATE_CRC) {
    messageCRC |= c;
    msgLengthCounter += 2;

    // Checksums don't match
    if (calculatedCRC != messageCRC) {
      return messageState = MSG_STATE_ABT;
    }

    // Set streaming bit for the next message
    else if (type == TYPE_STRM_RESP) {

      // Invalid if the type was not passed in the body
      if (bufferPos == 0) {
        return messageState = MSG_STATE_ABT;
      }

      type = buffer[0];
      streaming = 1;
      return messageState = MSG_STATE_STM;
    }
    else {
      streaming = 0;
    }

    return messageState = MSG_STATE_RDY;
  }

  // Batch update
  else if (type == TYPE_BATCH && messageState == MSG_STATE_BOD) {
    msgLengthCounter++;

    // We're in our message in the batch
    if (msgLengthCounter >= batchMsgStart && msgLengthCounter <= batchMsgEnd) {
      switch(batchMsgCounter++) {
        // First two bytes should be our address
        case 0:
        case 1:
          if (c != myAddress) {
            return messageState = MSG_STATE_ABT;
          }
        break;
        default:
          write(c);
      }
    }
    // End of the batch message, not checking CRC on this one
    else if (msgLengthCounter >= msgLength + 2) {

      // We received a message
      if (batchMsgCounter > 0 && batchMsgCounter == batchLength) {
        type = secondaryType;
        return messageState = MSG_STATE_RDY;
      }
      // Invalid message
      else {
        return messageState = MSG_STATE_IDL;
      }
    }
  }

  // Message body
  else if (messageState == MSG_STATE_BOD) {

    // Something went wrong
    if (msgLengthCounter > msgLength) {
      return messageState = MSG_STATE_ABT;
    }
    // End of the message, get CRC
    else if (msgLengthCounter == msgLength) {

      // If this was a streaming message, we're not returning it anyways
      if (streaming) {
        streaming = 0;
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
  // no second start of message character
  else if (messageState == MSG_STATE_SOM) {
    return messageState = MSG_STATE_ABT;
  }

  return messageState;
}

uint8_t MessageBuffer::processHeader(uint8_t c) {
  calculatedCRC = _crc16_update(calculatedCRC, c);
  switch(headerPos) {

    // Message address
    case 0:
      destAddress = c;
    break;

    // Length
    case 1:
      msgLength = c;

      // Not addressed to us (waited until length so we know how many characters to ignore)
      if (!addressedToMe()) {
        messageState = MSG_STATE_IGN;
      }
    break;

    // Type
    case 2:
      type = c;
      msgLengthCounter++;
      if (type != TYPE_BATCH) {
        return messageState = MSG_STATE_BOD;
      }
    break;

    // Batch content length
    case 3:
      msgLengthCounter++;

      batchLength = c + 2;                               // length plus double address which starts each batch message
      msgLength = (msgLength * batchLength) + 3;         // Full message length
      batchMsgStart = (myAddress - 1) * batchLength + 4; // Start of our part of the message
      batchMsgEnd = batchMsgStart + batchLength - 1;     // End of our part of the message
    break;

    // Batch Secondary type
    case 4:
      msgLengthCounter++;
      secondaryType = c;
      messageState = MSG_STATE_BOD;
    break;

  }
  headerPos++;
  return messageState;
}

uint8_t MessageBuffer::read() {
  digitalWrite(txControl, RS485Receive);
  digitalWrite(rxControl, RS485Receive);

  while (Serial.available() > 0) {
    timeoutCounter = 0;
    parse((uint8_t)Serial.read());

    // Return current message if it is ready or streaming
    if (isReady() || isStreaming()) {
      return messageState;
    }
  }
  timeoutCounter++;

  // Timeout current message
  if (timeoutCounter > 1000) {
    type = 0;
    streaming = 0;
    messageState = MSG_STATE_IDL;
  }

  // Respond in the streaming message
  // (FYI, if type is TYPE_STRM_RESP, we're in the streaming pre-message)
  if (streaming && streamingValueSet && type != TYPE_STRM_RESP && myAddress > 0 && msgLengthCounter == myAddress) {
    digitalWrite(txControl, RS485Transmit);
    digitalWrite(rxControl, RS485Transmit);

    sendAndChecksum(streamingValue);
    msgLengthCounter++;
    streamingValueSet = 0;

    digitalWrite(txControl, RS485Receive);
    digitalWrite(rxControl, RS485Receive);

    // Ignore the rest of the message
    messageState = MSG_STATE_IGN;
  }

  return messageState;
}

void MessageBuffer::sendAndChecksum(uint8_t c) {
  Serial.write(c);
  Serial.flush();
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
