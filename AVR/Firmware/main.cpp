/*******************************************************************************
* A single disco sqare node.
* 
* This program connects to a multi-drop network as a slave node and 
* waits for the master node to ask it to check the touch sensor and to set the color
* of the RGB LED.
******************************************************************************/

#include <avr/io.h>
#include <avr/wdt.h>
#include <avr/eeprom.h> 

#include "pwm.h"
#include "clock.h"
#include "touch.h"
#include "touch_control.h"
#include "touch_api.h"
#include "MultidropSlave.h"
#include "MultidropData485.h"
#include "version.h"

/*----------------------------------------------------------------------------
                                prototypes
----------------------------------------------------------------------------*/

void comm_init();
void comm_run();
void handle_message();
void handle_response_msg(uint8_t command, uint8_t *buff,uint8_t len);
void set_color(uint8_t *rgb);
void read_sensor();

/*----------------------------------------------------------------------------
                                constants
----------------------------------------------------------------------------*/

#define BUS_BAUD 250000
#define DEFAULT_DETECT_THRES 11u

// Message commands
#define CMD_RESET_NODE       0xFA
#define CMD_SET_ADDRESS      0xFB

#define CMD_GET_VERSION       0xA0
#define CMD_SET_COLOR         0xA1
#define CMD_CHECK_SENSOR      0xA2
#define CMD_SEND_SENSOR_VALUE 0xA3

#define CMD_SET_DETECT_THRESH 0xB0 // Set the QTouch detection threshold

// EEPROM byte addresses

// Since node addresses can go up to 0xFF and EEPROM default values are 0xFF, 
// we need to have an extra byte to tell us if the address has been set.
#define EEPROM_HAS_ADDR      (uint8_t*)0
#define EEPROM_ADDR          (uint8_t*)1
#define EEPROM_DETECT_THRESH (uint8_t*)2

/*----------------------------------------------------------------------------
                          global variables
----------------------------------------------------------------------------*/

// The last touch sensor value
uint8_t sensor_value = 0;
uint8_t reading_sensor = 0;

// Bus serial
MultidropData485 serial(PD2, &DDRD, &PORTD);
MultidropSlave comm(&serial);

/*----------------------------------------------------------------------------
                              program
----------------------------------------------------------------------------*/

/**
 * Main program
 */
int main() {
  wdt_disable();
  wdt_enable(WDTO_2S);

  DDRB |= (1 << PB2); // debug LED
  
  start_clock();
  comm_init();
  pwm_init();

  // Setup touch sensor
  uint8_t detect_threshold = eeprom_read_byte(EEPROM_DETECT_THRESH);
  if (detect_threshold == 0xFF) {
    detect_threshold = DEFAULT_DETECT_THRES;
  }
  touch_init(detect_threshold);

  // Program loop
  while(1) {
    wdt_reset();
    comm_run();
  }
}

/**
 * Initialize the serial communication bus.
 */
void comm_init() {
  // enable pull-up on RX pin
  PORTD |= (1 << PD0);

  serial.begin(BUS_BAUD);
  
  // Define daisy chain lines and let polarity (next/previous) be determined at runtime
  comm.addDaisyChain(PC3, &DDRC, &PORTC, &PINC,
                     PC4, &DDRC, &PORTC, &PINC);

  // Response message handler
  comm.setResponseHandler(&handle_response_msg);

  // Check if we have an address in the EEPROM
  uint8_t addr = eeprom_read_byte(EEPROM_ADDR);
  if (addr > 0 && eeprom_read_byte(EEPROM_HAS_ADDR) == 1) {
    comm.setAddress(addr);
  }
}

/**
 * Read the next bytes from the communication bus and handle any messages.
 */
void comm_run() {
  comm.read();
  if (comm.hasNewMessage() && comm.isAddressedToMe()) {
    handle_message();
  }
}

/**
 * Handle a new message received from the bus.
 */
void handle_message() {
  switch (comm.getCommand()) {
    // We've been assigned an address
    case CMD_SET_ADDRESS:
      if (comm.getAddress() > 0) {
        eeprom_update_byte(EEPROM_HAS_ADDR, 1);
        eeprom_update_byte(EEPROM_ADDR, comm.getAddress());
      }
    break;

    // The node and it's address reset
    case CMD_RESET_NODE:
      eeprom_update_byte(EEPROM_HAS_ADDR, 0);
      eeprom_update_byte(EEPROM_ADDR, 0);
    break;

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

    // Set the touch sensor detect threshold
    case CMD_SET_DETECT_THRESH:
      if (comm.getDataLen() == 1) {
        uint8_t dt = comm.getData()[0]; 
        eeprom_update_byte(EEPROM_DETECT_THRESH, dt);
        touch_init(dt);
      }
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
  if (reading_sensor) return;
  reading_sensor = 1;

  // Default MCU register value
  uint8_t mcuRegister = MCUCR;
  uint16_t status_flag = 0u;

  do {
    // Disable pull-ups
    MCUCR |= (1 << PUD);

    // Measure sensor
    status_flag = qt_measure_sensors( millis() );
    
    // Reset pull-ups
    MCUCR = mcuRegister;

    // Check bus before next measurement
    comm_run();
  } while (status_flag & QTLIB_BURST_AGAIN); // check again, if burst flag is set
  
  // Get sensor value
  sensor_value = GET_SENSOR_STATE(0);
  reading_sensor = 0;

  // Debug LED
  if (sensor_value) {
    PORTB |= (1 << PB2);
  } else {
    PORTB &= ~(1 << PB2);
  }
}
