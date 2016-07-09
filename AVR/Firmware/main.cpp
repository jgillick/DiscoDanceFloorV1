/*******************************************************************************
* A single disco sqare node.
* 
* This program connects to a multi-drop network as a slave node and 
* waits for the master node to ask it to check the touch sensor and to set the color
* of the RGB LED.
******************************************************************************/

#include <avr/io.h>

#include "pwm.h"
#include "clock.h"
#include "touch.h"
#include "touch_control.h"
#include "MultidropSlave.h"
#include "MultidropData485.h"
#include "version.h"

/*----------------------------------------------------------------------------
                                prototypes
----------------------------------------------------------------------------*/

void comm_init();
void handle_message();
void handle_response_msg(uint8_t command, uint8_t *buff,uint8_t len);
void set_color(uint8_t *rgb);
void read_sensor();

/*----------------------------------------------------------------------------
                                message commands
----------------------------------------------------------------------------*/

#define CMD_GET_VERSION       0xA0
#define CMD_SET_COLOR         0xA1
#define CMD_CHECK_SENSOR      0xA2
#define CMD_SEND_SENSOR_VALUE 0xA3

/*----------------------------------------------------------------------------
                                global variables
----------------------------------------------------------------------------*/

// The last touch sensor value
uint8_t sensor_value = 0;

// Bus serial
MultidropData485 serial(PD2, &DDRD, &PORTD);
MultidropSlave comm(&serial);

/*----------------------------------------------------------------------------
                                main program
----------------------------------------------------------------------------*/

int main() {
  DDRB |= (1 << PB2); // debug LED

  start_clock();
  comm_init();
  pwm_init();
  touch_init();

  while(1) {
    comm.read();
    if (comm.hasNewMessage() && comm.isAddressedToMe()) {
      handle_message();
    }
  }
}

/**
 * Initialize the serial communication bus.
 */
void comm_init() {
  // enable pull-up on RX pin
  PORTD |= (1 << PD0);

  serial.begin(9600);
  
  // Define daisy chain lines and let polarity (next/previous) be determined at runtime
  comm.addDaisyChain(PC3, &DDRC, &PORTC, &PINC,
                     PC4, &DDRC, &PORTC, &PINC);

  // Response message handler
  comm.setResponseHandler(&handle_response_msg);
}

/**
 * Handle a new message received from the bus.
 */
void handle_message() {
  switch (comm.getCommand()) {
    // Set the LED color
    case CMD_SET_COLOR:
      if (comm.getDataLen() == 3) {
        set_color(comm.getData());
      }
    break;
    // Check the touch sensor
    case CMD_CHECK_SENSOR:
      read_sensor();
    break;
  }
}

/**
 * Answer response messages from the bus.
 */
void handle_response_msg(uint8_t command, uint8_t *buff, uint8_t len) {
  switch (comm.getCommand()) {
    // Return our firmware version number
    case CMD_GET_VERSION:
      if (len >= 2) {
        buff[0] = FIRMWARE_VERSION_MAJOR;
        buff[1] = FIRMWARE_VERSION_MINOR;
      }
    break;

    // Send the last sensor value received
    case CMD_SEND_SENSOR_VALUE:
      if (len >= 1) {
        buff[0] = sensor_value;
      }
    break;
  }
}

/**
 * Update RGB LED values
 */
void set_color(uint8_t *rgb) {
  red_pwm(rgb[0]);
  green_pwm(rgb[1]);
  blue_pwm(rgb[2]);
}

/**
 * Get a new reading from the touch sensor.
 */
void read_sensor() {
  sensor_value = (touch_measure(0, millis()) != 0);

  if (sensor_value) {
    PORTB |= (1 << PB2);
  } else {
    PORTB &= ~(1 << PB2);
  }
}
