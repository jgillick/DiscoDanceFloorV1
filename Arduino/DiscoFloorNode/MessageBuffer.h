/**
  Creates a buffer for incoming and outgoing messages.

  Format
  ------
  Each message follows the format:
  0xFF 0xFF{ID}{len}{type}{data}{CRC}

  0xFF 0xFF  - The start of a message
  {addr}     - The address of the floor node the message is from or to (or 0x00 for broadcast)
  {len}      - The length of the message, including type
  {cmd}      - The message type or command (set LED, get sensor value, etc)
  {data}     - The body of the message
  {CRC}      - A 16-bit CRC

  ID
  --
  Messaging is always directly between the master and nodes
  and two nodes never communicate directly to each other. The
  ID will be either the broadcast ID (0x00) or the ID of the node.

  Addressing
  -----------
  All all communication is between the master and nodes. Nodes never communicate
  with eachother.

  Messages directly to nodes will be assumed to be sent from Master (0x0).
  Messages from nodes to master should start with the `to` address of 0 followed
  by the node's address.

  Master can choose to send a single message to one or more nodes
    + To address a single node, the `to` address will simply be that node's address
    + To address all nodes, the `to` address will be `*`.
    + To address a subsection of nodes:
      - All nodes at position 5 and higher, `to` will be: `5-*`
      - All nodes between 5 and 10 (inclusive), `to` will be: `5-10`

  Streaming
  ---------
  In order to received data from all nodes quickly, we use the streaming command.
  Master will broadcast a streaming command (0x02), with a secondary command type as the
  message body (i.e 0x06 for STATUS), to prepare all the nodes to stream their response
  in the next message.

  Then master will start a second message with the command to stream
  (same as the secondary type from the first message) and length will be the
  number of nodes on the bus.

  Then each node will respond with a single byte, in turn, to fill up the message body.

  Master will then close the message with the CRC code.

  Batch Update
  ------------
  The master can also update all nodes to different values in a single batch message. This is
  a message with a slightly different format than usual messages.

  The format of a batch update is:
  0xFF 0xFF 0x00  {len} {type} {lengthPerNode} {secondaryType} {nodeAddr} {nodeData}    ...  {CRC}

  0xFF 0xFF        - The start of a message
  0x00             - Broadcast to all nodes
  {len}            - The number of nodes we're updating
  {cmd}            - The message type or command (set LED, get sensor value, etc)
  {lengthPerNode}  - The length of data for each node (i.e. 3 for TYPE_COLOR for R,G,B)
  {secondaryType}  - The type that represents the updates (i.e. TYPE_COLOR)
  {nodeAddr}       - The node address, repeated twice (not included in lengthPerNode)
  {nodeData}       - Data for the node
  ...              - Repeat {nodeAddr} and {nodeData} for all nodes
  {CRC}            - CRC for the entire batch message
  For example, if we have 10 nodes and the master was sending a color update to all of them, it would look
  something like this:
*/


#ifndef MessageBuffer_H_
#define MessageBuffer_H_

#include <Arduino.h>
#include "Constants.h"

// Start of message
#define MSG_SOM 0xFF

// Address used to broadcast to all nodes from master
#define BROADCAST_ADDRESS 0x00

// Maximum size of the message buffer
#define MSG_BUFFER_LEN  255

// Message parsing status
#define MSG_STATE_IDL  0x00  // no data received
#define MSG_STATE_SOM  0x10  // start of message
#define MSG_STATE_HDR  0x20  // collecting header
#define MSG_STATE_BOD  0x30  // message body
#define MSG_STATE_CRC  0x40  // message CRC
#define MSG_STATE_STM  0x50  // message streaming
#define MSG_STATE_RDY  0x60  // message ready
#define MSG_STATE_IGN  0x80  // ignore message
#define MSG_STATE_ABT  0x81  // corrupt message
#define MSG_STATE_BOF  0x82  // buffer over flow

class MessageBuffer {
  private:

    uint16_t messageCRC,
             calculatedCRC,
             timeoutCounter,
             msgLength,
             msgLengthCounter,
             batchLength,
             batchMsgStart,
             batchMsgEnd,
             batchMsgCounter;

    uint8_t buffer[MSG_BUFFER_LEN + 1];

    uint8_t  type,
             secondaryType,
             myAddress,
             destAddress,
             bufferPos,
             headerPos,
             txControl,
             rxControl,
             weAreMaster,
             messageState,
             streaming,
             streamingValue,
             streamingValueSet;

    uint8_t address;

    // Set message type
    void setType(uint8_t);

    // Calculate the checksum for the current message
    uint8_t calculateChecksum();

    // Process the header from the buffer
    uint8_t processHeader(uint8_t);

    // Update a crc checksum with a new byte
    uint8_t crc_checksum(uint8_t, uint8_t);

    // Parse a character received from the serial stream
    uint8_t parse(uint8_t);

    // Send a byte to the serial stream and add it to the checksum
    void sendAndChecksum(uint8_t);

  public:
    MessageBuffer(uint8_t, uint8_t);

    // The message type
    uint8_t getType();

    // If the message is complete
    bool isReady();

    // Get the current state of reading the incoming message
    uint8_t getState();

    // Get the message address
    uint8_t getAddress();

    // Returns true if this is the start of a streaming message
    bool isStreaming();

    // Set the value to be sent as the streaming message for this node
    void setStreamingValue(uint8_t);

    // Returns true if we have set a streaming value
    bool isStreamingValueSet();

    // Returns the streaming value
    uint8_t getStreamingValue();

    // Make our messages from master
    void setMaster();

    // Filter all incoming messages for this address and
    // use this as the src address of all outgoing messages
    void setMyAddress(uint8_t);

    // Set a destination address (only useful if we are master)
    void setDestAddress(uint8_t);

    // Is the message address to us
    bool addressedToMe();

    // Return the body of the message
    uint8_t* getBody();

    // Return the length of the message body
    int getBodyLen();

    // Reset the entire message to a fresh state
    void reset();

    // Start a new message of a type
    void start(uint8_t type);

    // Write a character to the message body
    uint8_t write(uint8_t);

    // Write an array of characters to the message body
    uint8_t write(uint8_t *buf, uint8_t len);

    // Read from the serial object and parse the message.
    // Returns the message status
    uint8_t read();

    // Send the entire message to the Serial stream
    void send();
};

#endif MessageBuffer_H_
