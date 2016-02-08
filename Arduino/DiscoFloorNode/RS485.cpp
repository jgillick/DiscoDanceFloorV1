
#include "RS485.h"

#define TXEN_PIN  PD2
#define TXEN_DDR  DDRD
#define TXEN_PORT PORTD

#define RXEN_PIN  PC5
#define RXEN_DDR  DDRC
#define RXEN_PORT PORTC

void RS485::init() {
  TXEN_DDR |= (1 << TXEN_PIN);
  RXEN_DDR |= (1 << RXEN_PIN);
  setMode(RS485_RECEIVE);
}

void RS485::setMode(uint8_t mode) {
  if (mode == RS485_RECEIVE) {
    TXEN_PORT &= ~(1 << TXEN_PIN);
    RXEN_PORT &= ~(1 << RXEN_PIN);
  }
  else if (mode == RS485_SEND){
    TXEN_PORT |= (1 << TXEN_PIN);
    RXEN_PORT |= (1 << RXEN_PIN);
  }
}