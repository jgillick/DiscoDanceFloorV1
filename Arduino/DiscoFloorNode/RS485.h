
#ifndef RS485_h
#define RS485_h

#define RS485_RECEIVE 1
#define RS485_SEND    2

class RS485 {
  public:
    static void init();
    static void setMode(uint8_t);
};

#endif