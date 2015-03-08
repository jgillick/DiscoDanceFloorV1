
// Commands codes
#define TYPE_ACK          0x01 // Acknowledge command
#define TYPE_ADDR         0x02 // Announce address
#define TYPE_COLOR        0x04 // Set color
#define TYPE_FADE         0x05 // Set fade

// PINS
#define ENABLE_MASTER    2
#define NODE_STATUS      3    // HIGH when the floor node is running
#define NEXT_NODE        4    // Tells next node to set ID
#define ENABLE_NODE      6    // Sets ID when HIGH
#define TX_CONTROL       7    // RS485 TX Enable
#define SSERIAL_DEBUG_RX 12   // Debug SoftwareSerial RX line
#define SSERIAL_DEBUG_TX 13   // Debug SoftwareSerial TX line

#define LED_RED          11
#define LED_GREEN        9
#define LED_BLUE         10

#define ACK_TIMEOUT      1000 // How many milliseconds to wait for an ACK

#define FADE_DIVIDER     250  // What to divide the duration by before sending

#define RS485Transmit    HIGH
#define RS485Receive     LOW