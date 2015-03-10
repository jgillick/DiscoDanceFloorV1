/**
  Creates a buffer for incoming and outgoing messages.

  Format
  ------
  Each message follows the format:
  >{to}{from},{type}{body}{checksum}\n

  >          - The start of a message
  {to}       - Is the address to the node the message is going to
  {from}     - (optional) Is the address the message is from (0 - 255). 
               Only when a node is communicating to master (see Addressing)
  ,          - Marks the end of the header
  {type}     - The message type (set LED, get sensor value, etc)
  {body}     - The body of the message
  {checksum} - (not yet implemented) A 2 byte fletcher16 checksum
  \n         - Marks the end of the message

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

  Escaping
  --------
  Use '\' to escape any character in the message
*/


#ifndef MessageBuffer_H_
#define MessageBuffer_H_
  
#include <util/crc16.h>
#include <Arduino.h>
#include "Constants.h"

#define MASTER_ADDRESS  1

// Message format and characters
#define MSG_SOM         '>'   // Start of message
#define MSG_EOM         '\n'  // End of message
#define MSG_EOH         ','   // End of header
#define MSG_ESC         '\\'  // Escape character
#define MSG_ALL         '*'   // The address used for all nodes

// Maximum size of the message buffer
#define MSG_BUFFER_LEN  10    

// Message parsing status
#define MSG_STATE_IDL  0x00  // no data received
#define MSG_STATE_HDR  0x10  // collecting header
#define MSG_STATE_ACT  0x20  // message active
#define MSG_STATE_IGN  0x40  // ignore message
#define MSG_STATE_RDY  0x80  // message ready
#define MSG_STATE_ABT  0x81  // abnormal termination
#define MSG_STATE_BOF  0x82  // buffer over flow 

class MessageBuffer {
  private: 
    
    uint8_t  type,
             myAddress,
             srcAddress,
             bufferPos,
             txControl,
             messageState;
    // bool escaped;
    uint8_t buffer[MSG_BUFFER_LEN + 1];

    // The range of addresses this message is for
    // `toRange[0]` and `toRange[0]` are inclusive, both addresses are included in the range.
    // When `toRange[1]` is '-', the message is addressed to everything from `toRange[0]` forward.
    uint8_t addressDestRange[2];

    // Add a single character to the message buffer (this skips message processing)
    uint8_t addToBuffer(uint8_t);

    // Process the header from the buffer
    uint8_t processHeader();

    void setType(uint8_t);
    uint8_t calculateChecksum();
  public:
    MessageBuffer(uint8_t);
    
    // Always set to false for new messages. The consumer can set this to false to indicate the message has been dealt with
    bool isNew;

    // The message type
    uint8_t getType();

    // The time the current message was sent
    long sentAt;
    
    // If the message is complete
    bool isReady();

    // Get the current state of reading the incoming message
    uint8_t getState();

    // Get the address the message is from
    uint8_t getSourceAddress();

    // Get the lower end of the destination range
    uint8_t getLowerDestRange();

    // Get the upper end of the destination range ('*' means everything after lower range)
    uint8_t getUpperDestRange();

    // Filter all incoming messages for this address and 
    // use this as the src address of all outgoing messages
    void setMyAddress(uint8_t);

    // Set the destination address range (the second value can be '-', to mean everything including and after the first)
    void setDestAddress(uint8_t, uint8_t);

    // Set a single destination address
    void setDestAddress(uint8_t);

    // Does the destination address (or range) match our address
    bool addressedToMe();

    // Is the message addressed to master
    bool addressedToMaster();

    // Return the body of the message
    uint8_t* getBody();

    // Return the length of the message body
    int getBodyLen();

    // Reset the entire message to a fresh state
    void reset();

    // Start a new message of a type
    void start(uint8_t type);

    // Write a character to the message
    // If addresses are not set, this will attempt to parse the entire message from start to finish
    // Returns the message status
    uint8_t write(uint8_t);

    // Write a buffer of characters to the message
    uint8_t write(uint8_t*, uint8_t);

    // Read from the serial object and parse the message.
    // Returns the message status
    uint8_t read();
    
    // Send the entire message to the Serial stream and returns the number of bytes sent
    uint8_t send();
};

#endif MessageBuffer_H_
