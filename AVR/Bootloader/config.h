/*****************************************************************************
*
* Configuration settings for the bootloader
*
****************************************************************************/

#ifndef CONFIG_H
#define CONFIG_H


////////////////////////////////////////////
/// Activate booloader by EEPROM
////////////////////////////////////////////

// Enter programming mode when the EEPROM value
// at address EEPROM_RUN_APP is not 1
#define BOOTLOAD_ON_EEPROM 1

// EEPROM Address
#define EEPROM_RUN_APP (uint8_t*) 3


////////////////////////////////////////////
/// Activate bootloader by pin
////////////////////////////////////////////

// Enter programming mode when a pin matches
// the on/off value defined by BOOTLOAD_PIN_VAL (1 = HIGH)
#define BOOTLOAD_ON_PIN   0
#define BOOTLOAD_PIN_NUM  PD2
#define BOOTLOAD_PIN_DDR  DDRD
#define BOOTLOAD_PIN_REG  PIND
#define BOOTLOAD_PIN_VAL  1


////////////////////////////////////////////
/// Versioning
////////////////////////////////////////////

// The version stored in EEPROM will be compared to the
// version sent to the bootloader. If they're the same, the
// device will skip programming.
#define USE_VERSIONING 0

// The EEPROM address of where the major and minimum version numbers
// are stored. These need to be stored by your program, the bootloader
// does not write to these locations.
#define VERSION_MAJOR (uint8_t*) 4
#define VERSION_MINOR (uint8_t*) 5


////////////////////////////////////////////
/// Signal Line
////////////////////////////////////////////

#define SIGNAL_BIT PD7
#define SIGNAL_DDR_REG DDRD
#define SIGNAL_PIN_REG PIND


////////////////////////////////////////////
/// Communications
////////////////////////////////////////////

// #define SERIAL_BAUD 250000
#define SERIAL_BAUD 115200

////////////////////////////////////////////
/// Bus Message Commands
////////////////////////////////////////////

// Start programming
#define MSG_CMD_PROG_START 0xF1

// Receive the next page number
#define MSG_CMD_PAGE_NUM   0xF2

// Receive the next page of data
#define MSG_CMD_PAGE_DATA  0xF3

// Finish programming and start the main program
#define MSG_CMD_PROG_END   0xF4

#endif

////////////////////////////////////////////
/// Status LEDs
////////////////////////////////////////////

#define OK_LED  PD5
#define OK_DDR  DDRD
#define OK_PORT PORTD

#define WRITE_LED   PB1
#define WRITE_DDR   DDRB
#define WRITE_PORT  PORTB

#define ERROR_LED   PD6
#define ERROR_DDR   DDRD
#define ERROR_PORT  PORTD
