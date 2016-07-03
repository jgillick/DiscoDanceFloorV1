
#ifndef TOUCH_CONTROL_H
#define TOUCH_CONTROL_H

/* This will initialize touch related code */
void touch_init( void );

/* This will call all the functions for touch related measurement */
uint8_t touch_measure(uint8_t sensor_num, uint16_t current_time);

/*  Assign the parameters values to global configuration parameter structure    */
static void qt_set_parameters( void );

/*  Configure the sensors */
static void config_sensors(void);

extern "C" uint16_t qt_measure_sensors( uint16_t current_time_ms );

#endif
