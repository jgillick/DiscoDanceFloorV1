
#include <avr/io.h>

#include "config.h"
#include "status.h"

// Turn all the status LEDs off
void resetStatus() {
  OK_PORT &= ~(1 << OK_LED);
  OK_DDR &= ~(1 << OK_LED);

  ERROR_PORT &= ~(1 << ERROR_LED);
  ERROR_DDR &= ~(1 << ERROR_LED);

  WRITE_PORT &= ~(1 << WRITE_LED);
  WRITE_DDR &= ~(1 << WRITE_LED);
}

// Set the status to "Ok"
void statusOk() {
  resetStatus();
  OK_DDR |= (1 << OK_LED);
  OK_PORT |= (1 << OK_LED);
}

// Set the status to writing a page of the program
void statusWriting() {
  resetStatus();
  WRITE_DDR |= (1 << WRITE_LED);
  WRITE_PORT |= (1 << WRITE_LED);
}

// Set the status to error
void statusError() {
  resetStatus();
  ERROR_DDR |= (1 << ERROR_LED);
  ERROR_PORT |= (1 << ERROR_LED);
}