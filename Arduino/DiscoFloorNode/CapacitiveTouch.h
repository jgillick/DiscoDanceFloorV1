
/**
  A capacitive touch/proximity sensor library that runs "in the background".
  More specifically, it uses an AVR timer to make a sesor measurement and adjustment
  about every microsecond.
*/

#ifndef CapacitiveTouch_h
#define CapacitiveTouch_h

#include <Arduino.h>
#include <avr/interrupt.h>

#define CT_SAMPLE_SIZE   20     // how many samples taken to determine the value
#define CT_FILTER_SIZE   10     // how many readings to use for smoothing filter
#define CT_CAL_TIMEOUT   5000   // minimum milliseconds between value calibration
#define CT_SENSE_TIMEOUT 5      // milliseconds before sensor read times out

#define USECPERTICK      10      // microseconds per clock interrupt tick


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

  // Force a new calibration
  void calibrate();

private:
  // Find the element at index k, if the array was sorted.
  // From http://www.stat.cmu.edu/~ryantibs/median/quickselect.c
  long quickselect(long *arr, int len, int k);
};

/**
  State struct that will be used in the AVR timer
*/
struct CapTouchParams {
  uint8_t ticks,
          state,
          sendPin,
          sensorPin,
          numSamples,
          sampleIndex,
          filterIndex;

  long value,
       samplesTotal,
       baseline;

  unsigned long calibrateTime,
                calibrateMilliseconds,
                timeoutTime,
                timeoutMilliseconds;

  long filerValues[CT_FILTER_SIZE];

};

// For QuickSelect function
#define SWAP(a,b) temp=(a);(a)=(b);(b)=temp;

/**
  Timer macros copied and modified from the Arduino IRremote library
*/
#ifdef F_CPU
#define SYSCLOCK F_CPU     // main Arduino clock
#else
#define SYSCLOCK 16000000  // main Arduino clock
#endif

#define TIMER_ENABLE_INTR    (TIMSK2 = _BV(OCIE2A))
#define TIMER_DISABLE_INTR   (TIMSK2 = 0)
#define TIMER_COUNT_TOP      (SYSCLOCK * USECPERTICK / 1000000)

#if (TIMER_COUNT_TOP < 256)
#define TIMER_CONFIG_NORMAL() ({ \
  TCCR2A = _BV(WGM21); \
  TCCR2B = _BV(CS20); \
  OCR2A = TIMER_COUNT_TOP; \
  TCNT2 = 0; \
})
#else
#define TIMER_CONFIG_NORMAL() ({ \
  TCCR2A = _BV(WGM21); \
  TCCR2B = _BV(CS21); \
  OCR2A = TIMER_COUNT_TOP / 8; \
  TCNT2 = 0; \
})
#endif (TIMER_COUNT_TOP < 256)

#endif CapacitiveTouch_h