
/**
  A capacitive touch/proximity sensor library that runs "in the background".
  More specifically, it uses an AVR timer to make a sesor measurement and adjustment
  about every microsecond.
*/

#ifndef CapacitiveTouch_h
#define CapacitiveTouch_h

#include <Arduino.h>
#include <avr/interrupt.h>

#define CT_SAMPLE_SIZE       15     // how many samples taken to determine the value
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

  uint8_t pulseDone,
          sendPin,
          sensorPin,
          numSamples,
          sampleIndex,
          valueReady,
          overflows;

  int32_t value,
          baseline;

  uint32_t pulseTime,
           calibrateTimeMin,
           calibrateTimeMax,
           calibrateMillisecondsMin,
           calibrateMillisecondsMax;

  int32_t samples[CT_SAMPLE_SIZE];
};

#endif CapacitiveTouch_h