/*******************************************************************************
* Touch Controller
*
* Handles initializing the QTouch library and detecting touches.
******************************************************************************/

/*----------------------------------------------------------------------------
                                include files
----------------------------------------------------------------------------*/
#include <avr/io.h>
#include "touch_api.h"
#include "touch.h"
#include "touch_control.h"

/*----------------------------------------------------------------------------
                                extern variables
----------------------------------------------------------------------------*/

/* This configuration data structure parameters if needs to be changed will be
   changed in the qt_set_parameters function */
extern qt_touch_lib_config_data_t qt_config_data;

/* touch output - measurement data */
extern qt_touch_lib_measure_data_t qt_measure_data;

/*============================================================================
 * Initialize the QTouch library
 *============================================================================*/
void touch_init( uint8_t detect_threshold ) {

  /* Configure the Sensors as keys or Keys With Rotor/Sliders in this function */
  config_sensors(detect_threshold);

  /* initialise touch sensing */
  qt_init_sensing();

  /*  Set the parameters like recalibration threshold, Max_On_Duration etc in this function by the user */
  qt_set_parameters();
}


/*============================================================================
 * Measure a touch sensor.
 *   + sensor_num: The sensor to measure (zero indexed)
 *   + current_time: The current time, in milliseconds
 *   + max_measurements: If multiple measurements are needed, this is the maximum measurements to make.
 *
 * Returns 1 = touch detected, 0 = no touch
 *============================================================================*/
uint8_t touch_measure(uint8_t sensor_num, uint16_t current_time, uint8_t max_measurements) {

  // Disable all pull-ups
  uint8_t mcuRegister = MCUCR;
  MCUCR |= (1 << PUD);

	// status flags to indicate the re-burst for library
  static uint16_t status_flag = 0u;
  static uint16_t burst_flag = 0u;
  uint8_t measure_count = 0;

  do {
    status_flag = qt_measure_sensors( current_time );
    burst_flag = status_flag & QTLIB_BURST_AGAIN;
    measure_count++;
  } while (burst_flag && measure_count < max_measurements);

  // Reset pull-ups
  MCUCR = mcuRegister;

  return GET_SENSOR_STATE(sensor_num);
}
uint8_t touch_measure(uint8_t sensor_num, uint16_t current_time) {
  return touch_measure(sensor_num, current_time, 100);
}


/*============================================================================
 * Set the QTouch detection parameters and threshold values.
 *===========================================================================*/
static void qt_set_parameters() {
  qt_config_data.qt_di              = 3; // how many positive sequential aquisitions to represent a touch.
  qt_config_data.qt_neg_drift_rate  = 20;
  qt_config_data.qt_pos_drift_rate  = 5;
  qt_config_data.qt_max_on_duration = 25; // 5 seconds
  qt_config_data.qt_drift_hold_time = 20;
  qt_config_data.qt_recal_threshold = RECAL_12_5;
  qt_config_data.qt_pos_recal_delay = 3;
}

/*============================================================================
 * Setup all the sensors
 *============================================================================*/
static void config_sensors(uint8_t detect_threshold) {
  qt_enable_key( CHANNEL_0, NO_AKS_GROUP, detect_threshold, HYST_6_25 );
}


