
// Commands codes
#define TYPE_ACK          0x01 // Acknowledge command
#define TYPE_ADDR         0x02 // Announce address
#define TYPE_COLOR        0x04 // Set color
#define TYPE_FADE         0x05 // Set fade
#define TYPE_STATUS       0x06 // Set or Get node status
#define TYPE_RESET        0x10 // Reset node

// Flags
#define FADING           B001
#define SENSOR_DETECT    B010

// PINS
#define ENABLE_MASTER    2
#define SENSOR_SEND      3    // Connect a resistor from this pin to SENSOR_OUT
#define SENSOR_TOUCH     4    // Connected to sensor area
#define NEXT_NODE        5    // Enables the next node so it can register itself
#define ENABLE_NODE      6    // Sets ID when HIGH
#define TX_CONTROL       7    // RS485 TX Enable
#define NODE_STATUS      8

// For master debugging
#define SSERIAL_DEBUG_RX 12   // Debug SoftwareSerial RX line
#define SSERIAL_DEBUG_TX 13   // Debug SoftwareSerial TX line

#define LED_RED          11
#define LED_GREEN        9
#define LED_BLUE         10

#define ACK_TIMEOUT      10   // How many milliseconds to wait for an ACK

#define FADE_DIVIDER     250  // What to divide the duration by before sending

#define RS485Transmit    HIGH
#define RS485Receive     LOW