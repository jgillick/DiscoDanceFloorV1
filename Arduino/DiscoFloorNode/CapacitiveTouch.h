
/**
  A capacitive touch/proximity sensor library that runs "in the background".
  More specifically, it uses an AVR timer to make a sesor measurement and adjustment
  about every microsecond.
*/

#ifndef CapacitiveTouch_h
#define CapacitiveTouch_h

#include <Arduino.h>
#include <avr/interrupt.h>

#define CT_SAMPLE_SIZE       20     // how many samples taken to determine the value
#define CT_SENSE_TIMEOUT     100    // milliseconds before sensor read times out
#define CT_THRESHOLD_PERCENT 0.05   // When the sensor value goes x% over the baseline, it's seen as a touch event.

#define CT_CAL_TIMEOUT_MIN   2000    // Minimum milliseconds between baseline calibrations
#define CT_CAL_TIMEOUT_MAX   9000    // Maximum milliseconds between baseline calibrations

#define CT_KALMAN_PROCESS_NOISE    1
#define CT_KALMAN_SENSOR_NOISE     20

/**
  Main class
*/
class CapacitiveTouch
{

public:
  // Constructor
  CapacitiveTouch(int8_t sendPin, int8_t sensorPin);

  // Start reading capacitive sensor
  void begin();

  // Get the raw unfiltered sensor value
  int32_t rawValue();

  // Get the sensor value
  int32_t sensorValue();

  // Return the baseline value seen as zero
  int32_t baseline();

  // Set the gain to detect at a greater distance.
  // This will return a larger range of valuea and can produce more noise.
  void setGain(uint8_t gain);

  // Tune the Kalman filter values
  // See: http://interactive-matter.eu/blog/2009/12/18/filtering-sensor-data-with-a-kalman-filter/
  void filterTuning(double processNoise, double sensorNoise, uint8_t startValue);

  // Set the number of milliseconds between value calibrations
  //  * minMilliseconds: How long between calibrations, as long as a touch event is not suspected (see baselineTuning)
  //  * maxMilliseconds: Force a calibration after this number of milliseconds
  void setCalibrationTimeout(uint32_t minMilliseconds);
  void setCalibrationTimeout(uint32_t minMilliseconds, uint32_t maxMilliseconds);

  // Force a new calibration
  void calibrate();
};

/**
  State struct that will be used in the AVR timer
*/
struct CapTouchParams {

  // Kalman filter
  double q, r, x, p, k;

  uint8_t sendPin,
          sensorPin,
          pulseDone,
          sampleIndex,
          valueReady,
          overflows;

  int32_t gain,
          gainTotal,
          gainIndex,
          value,
          rawValue,
          baseline;

  uint32_t pulseTime,
           calibrateTimeMin,
           calibrateTimeMax,
           calibrateMillisecondsMin,
           calibrateMillisecondsMax;
};


#endif CapacitiveTouch_h