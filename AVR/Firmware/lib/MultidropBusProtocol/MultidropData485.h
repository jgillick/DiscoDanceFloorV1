
#ifndef MultidropData485_H
#define MultidropData485_H

#include "MultidropDataUart.h"
#include <avr/io.h>

class MultidropData485 : public MultidropDataUart {
public:
  MultidropData485(volatile uint8_t de_pin_num,
                   volatile uint8_t* de_ddr_register,
                   volatile uint8_t* de_port_register);

  void write(uint8_t byte);
  void enable_write();
  void enable_read();

private:
  volatile uint8_t de_pin;
  volatile uint8_t* de_ddr;
  volatile uint8_t* de_port;
};

#endif