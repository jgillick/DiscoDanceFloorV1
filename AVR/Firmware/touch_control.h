
#ifndef TOUCH_CONTROL_H
#define TOUCH_CONTROL_H

// Get the state of a single sensor
#define GET_SENSOR_STATE(SENSOR_NUMBER) qt_measure_data.qt_touch_status.sensor_states[(SENSOR_NUMBER/8)] & (1 << (SENSOR_NUMBER % 8))

// Initialize the touch sensors
void touch_init( uint8_t detect_threshold );

// Make a touch measurement 
uint8_t touch_measure(uint8_t sensor_num, uint16_t current_time);
uint8_t touch_measure(uint8_t sensor_num, uint16_t current_time, uint8_t max_measurements);

// Assign the parameters values to global configuration parameter structure
static void qt_set_parameters( void );

//  Configure the sensors
static void config_sensors(uint8_t detect_threshold);

extern "C" uint16_t qt_measure_sensors( uint16_t current_time_ms );

#endif
