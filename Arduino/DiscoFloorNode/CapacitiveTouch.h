
/**
  A capacitive touch/proximity sensor library that runs "in the background".
  More specifically, it uses an AVR timer to make a sesor measurement and adjustment
  about every microsecond.
*/

#ifndef CapacitiveTouch_h
#define CapacitiveTouch_h

#include <Arduino.h>
#include <avr/interrupt.h>

/**
Choose which type of interrupt you want to use for sensing:
  + Timer Interrupt
*/
#define CT_WITH_TIMER_INT

#define CT_SAMPLE_SIZE       30     // how many samples taken to determine the value
#define CT_SENSE_TIMEOUT     100    // milliseconds before sensor read times out
#define CT_THRESHOLD_PERCENT 0.05   // When the sensor value goes x% over the baseline, it's seen as a touch event.

#define CT_CAL_TIMEOUT_MIN   2000    // Minimum milliseconds between baseline calibrations
#define CT_CAL_TIMEOUT_MAX   9000    // Maximum milliseconds between baseline calibrations
#define CT_BASELINE_LIMIT    0.05    // Calibrate baseline if sensor is below x% of baseline
#define CT_BASELINE_SMOOTH   0.005   // Set baseline to sensor value, if it's within x% of current baseline

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

  // Get the sensor value
  int32_t sensorValue();

  // Set the number of samples are taken to determin the sensor value
  // A higher number usually means better precision. This doesn't have much to do
  // with filtering, it simply adds all the samples together to generate the value.
  //  * default = CT_SAMPLE_SIZE (20)
  void setSampleSize(uint8_t sampleSize);

  // How many milliseconds until the sensor read times out.
  // If a timeout occurs the value will be -2. You should check your
  // connections and make sure that the resistor value is not too high.
  //  * default = CT_SENSE_TIMEOUT (5)
  void setTimeout(uint32_t timeoutMilliseconds);

  // Set the number of milliseconds between value calibrations
  //  * minMilliseconds: How long between calibrations, as long as a touch event is not suspected (see baselineTuning)
  //  * maxMilliseconds: Force a calibration after this number of milliseconds
  void setCalibrationTimeout(uint32_t minMilliseconds);
  void setCalibrationTimeout(uint32_t minMilliseconds, uint32_t maxMilliseconds);

  // These two decimal % values (0.0 - 1.0) help to let the baseline adjust over time.
  //  * limit: If a new value is x% over baseline, do not move baseline (assumed a touch event)
  //  * smoothing: If a new value is below the limit but within x% of baseline, set baseline to this value
  void baselineTuning(float limit, float smoothing);

  // Force a new calibration
  void calibrate();

  int32_t baseline();
};

/**
  State struct that will be used in the AVR timer
*/
struct CapTouchParams {
  float baselineLimit,
        baselineSmoothing;

  uint8_t state,
          sendPin,
          sensorPin,
          numSamples,
          sampleIndex;

  int32_t value,
          baseline;

  uint32_t ticks,
           calibrateTimeMin,
           calibrateTimeMax,
           calibrateMillisecondsMin,
           calibrateMillisecondsMax,
           timeoutTime,
           timeoutMilliseconds;

};

#endif CapacitiveTouch_h