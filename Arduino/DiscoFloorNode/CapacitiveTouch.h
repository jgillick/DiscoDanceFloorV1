
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
#define CT_FILTER_SIZE       4      // how many readings to use for smoothing filter
#define CT_SENSE_TIMEOUT     100    // milliseconds before sensor read times out
#define CT_THRESHOLD_PERCENT 0.02   // When the sensor value goes x% over the baseline, it's seen as a touch event.

#define CT_CAL_TIMEOUT_MIN   2000    // Minimum milliseconds between baseline calibrations
#define CT_CAL_TIMEOUT_MAX   9000    // Maximum milliseconds between baseline calibrations
#define CT_BASELINE_SMOOTH   0.01    // Recalibrate baseline if sensor value is within x% of current baseline
#define CT_BASELINE_LIMIT    0.05    // Calibrate baseline if sensor is not above x% of baseline

/**
  Main class
*/
class CapacitiveTouch
{

public:
  // Constructor
  CapacitiveTouch(int sendPin, int sensorPin);

  // Start reading capacitive sensor
  void begin();

  // Get the sensor value
  long sensorValue();

  // Get a filtered sensor value
  // This takes last 10 values, removes any value 15% away from the median and averages the rest
  long filteredValue();

  // Set the number of samples are taken to determin the sensor value
  // A higher number usually means better precision. This doesn't have much to do
  // with filtering, it simply adds all the samples together to generate the value.
  //  * default = CT_SAMPLE_SIZE (20)
  void setSampleSize(unsigned int sampleSize);

  // How many milliseconds until the sensor read times out.
  // If a timeout occurs the value will be -2. You should check your
  // connections and make sure that the resistor value is not too high.
  //  * default = CT_SENSE_TIMEOUT (5)
  void setTimeout(unsigned long timeoutMilliseconds);

  // Set the minimum number of milliseconds between value calibrations
  //  * default = CT_CAL_TIMEOUT (5000)
  void setCalibrationTimeout(unsigned long calibrateMilliseconds);

  // Set the maximum number of milliseconds between value calibrations
  void setMaxCalibrationTimeout(unsigned long calibrateMilliseconds);

  // When the sensor value goes x% over the baseline, it's seen as a touch event.
  // The value should be a percent defined as a decimal. i.e 5% = 0.05
  void setThreshold(float percent);

  // Force a new calibration
  void calibrate();

  long baseline();
};

/**
  State struct that will be used in the AVR timer
*/
struct CapTouchParams {
  float threshold;

  uint8_t ticks,
          state,
          sendPin,
          sensorPin,
          numSamples,
          sampleIndex,
          filterIndex;

  long value,
       start,
       samplesTotal,
       baseline;

  unsigned long calibrateTimeMin,
                calibrateTimeMax,
                calibrateMillisecondsMin,
                calibrateMillisecondsMax,
                timeoutTime,
                timeoutMilliseconds;

  long filerValues[CT_FILTER_SIZE];

};

// For QuickSelect function
#define SWAP(a,b) temp=(a);(a)=(b);(b)=temp;

#endif CapacitiveTouch_h