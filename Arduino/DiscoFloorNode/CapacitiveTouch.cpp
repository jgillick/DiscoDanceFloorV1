#include "CapacitiveTouch.h"

#ifdef DISABLED

volatile CapTouchParams ctp;
void getNextSensorValue();

// Minimum millisecond delay between sensor charges
#define DELAY_TIME 5.0

// Timer interrupt macros
#define ENABLE_TIMER() { \
  TCCR1A = 0; \
  TCCR1B = 0; \
  OCR1A = round(F_CPU / 8 * DELAY_TIME / 1000); \
  TCCR1B |= (1 << WGM12); \
  TCCR1B |= (1 << CS10); \
  TIMSK1 |= (1 << OCIE1A); \
}
#define DISABLE_TIMER() { \
  TIMSK1 &= ~(1 << OCIE1A); \
  TCCR1B &= ~(1 << WGM12); \
}

// Input capture unit macros
#define ENABLE_ICU() { \
  ACSR = 0; \
  TCCR1B = 0; \
  TCCR1B |= (1 << ICNC1); /* Noise canceller */ \
  TCCR1B |= (1 << CS10); /* Start timer, prescale by 8 */ \
  TCCR1B |= (1 << ICES1); /* Trigger on rising edge */ \
  TCCR1A = 0; /* Clear timer state */ \
  TCNT1 = 0; \
  TIMSK1 = 1 << ICIE1 | 1 << TOIE1; \
}
#define DISABLE_ICU() { \
  ctp.overflows = 0; \
  TCCR1B = 0; \
  TCNT1 = 0;  \
  TIMSK1 = 0; \
}

/**
 Overflow interrupt for ICU
*/
ISR(TIMER1_OVF_vect) {
  ctp.overflows++;

  if (ctp.overflows >= 10) {
    ctp.pulseTime = (ctp.overflows << 16);
    ctp.pulseDone = true;

    DISABLE_ICU();

    // Discharge
    digitalWrite(ctp.sendPin, LOW);
    pinMode(CT_RECEIVE_PIN, OUTPUT);
    digitalWrite(CT_RECEIVE_PIN, LOW);
  }
}

/**
  Input capture interrupt
  Triggered with ICU is HIGH
*/
ISR(TIMER1_CAPT_vect) {
  ctp.pulseTime = ICR1;

  // if just missed an overflow
  uint8_t overflowCopy = ctp.overflows;
  if ((TIFR1 & bit(TOV1)) && ctp.pulseTime < 0x7FFF) {
    overflowCopy++;
  }

  DISABLE_ICU();
  sei();

  ctp.pulseTime += (overflowCopy << 16);
  ctp.pulseDone = true;

  // Discharge
  digitalWrite(ctp.sendPin, LOW);
  pinMode(CT_RECEIVE_PIN, OUTPUT);
  digitalWrite(CT_RECEIVE_PIN, LOW);

  ENABLE_TIMER();
  sei();
}

/*
  Timer interrupt
  Processes ICU time and kicks off the next
  sensor reading.
*/
ISR(TIMER1_COMPA_vect) {
  if (!ctp.pulseDone) return;

  // Stop next timer interrupt while processing
  DISABLE_TIMER();
  sei();

  ctp.gainTotal += ctp.pulseTime;
  ctp.gainIndex++;

  if (ctp.gainIndex > ctp.gain) {
    ctp.rawValue = ctp.gainTotal;

    // Kalman filter adapted from:
    // http://interactive-matter.eu/blog/2009/12/18/filtering-sensor-data-with-a-kalman-filter/
    ctp.p = ctp.p + ctp.q;
    ctp.k = ctp.p / (ctp.p + ctp.r);
    ctp.x = ctp.x + ctp.k * (ctp.gainTotal - ctp.x);
    ctp.p = (1 - ctp.k) * ctp.p;

    // Serial.print(ctp.gainTotal);
    // Serial.print("\t");
    // Serial.println(ctp.x);

    // It takes about 50 initial samples for the value to be stable
    if (!ctp.valueReady) {
      ctp.sampleIndex++;
      if (ctp.sampleIndex >= 50) {
        ctp.valueReady = true;
      }
    }

    // Process value and baseline
    else {
      uint32_t now = millis(),
               val = ctp.x,
               diff = abs(val - ctp.baseline);

      // Update baseline
      if (val < ctp.baseline){// && diff < 0.02 * ctp.baseline) {
        ctp.baseline = val;
      }
      // Calibrate baseline, if sensor is not being touched
      else if (now >= ctp.calibrateTimeMin && diff < (CT_THRESHOLD_PERCENT * ctp.baseline)) {
        ctp.baseline = val;
        ctp.calibrateTimeMin = now + ctp.calibrateMillisecondsMin;
        ctp.calibrateTimeMax = now + ctp.calibrateMillisecondsMax;
      }
      // Force calibration
      else if (now >= ctp.calibrateTimeMax) {
        ctp.baseline = val;
        ctp.calibrateTimeMin = now + ctp.calibrateMillisecondsMin;
        ctp.calibrateTimeMax = now + ctp.calibrateMillisecondsMax;
      }
      ctp.value = val - ctp.baseline;
    }

    // Reset gain values
    ctp.gainIndex = 0;
    ctp.gainTotal = 0;
  }

  // Start all over again
  getNextSensorValue();
}

/**
  CapactiveTouch class constructor
*/
CapacitiveTouch::CapacitiveTouch(int8_t sendPin) {
  pinMode(sendPin, OUTPUT);
  pinMode(CT_RECEIVE_PIN, INPUT);

  ctp.gain = 0;
  ctp.sendPin = sendPin;

  // Kalman filter
  ctp.q = CT_KALMAN_PROCESS_NOISE;
  ctp.r = CT_KALMAN_SENSOR_NOISE;
  ctp.x = 0;
  ctp.p = 0;
  ctp.k = 0;

  setCalibrationTimeout(CT_CAL_TIMEOUT_MIN, CT_CAL_TIMEOUT_MAX);

  ctp.sampleIndex = 0;
}

void CapacitiveTouch::begin() {
  ctp.valueReady = false;
  calibrate();

  ctp.rawValue = 0;
  ctp.gainIndex = 0;
  ctp.gainTotal = 0;

  // Reset pins
  pinMode(ctp.sendPin, OUTPUT);
  pinMode(CT_RECEIVE_PIN, INPUT);
  digitalWrite(ctp.sendPin, LOW);
  delayMicroseconds(10);

  // Start
  getNextSensorValue();
}

int32_t CapacitiveTouch::rawValue() {
  return ctp.rawValue;
}

int32_t CapacitiveTouch::sensorValue() {
  return (ctp.value > 0) ? ctp.value : 0;
}

int32_t CapacitiveTouch::baseline() {
  return ctp.baseline;
}

void CapacitiveTouch::setGain(uint8_t gain) {
  ctp.gain = gain;
}

void CapacitiveTouch::filterTuning(double processNoise, double sensorNoise, uint8_t startValue) {
  ctp.q = processNoise;
  ctp.r = sensorNoise;
  ctp.x = startValue;
}

void CapacitiveTouch::setCalibrationTimeout(uint32_t minMilliseconds) {
  ctp.calibrateMillisecondsMin = minMilliseconds;
}
void CapacitiveTouch::setCalibrationTimeout(uint32_t minMilliseconds, uint32_t maxMilliseconds) {
  setCalibrationTimeout(minMilliseconds);
  ctp.calibrateMillisecondsMax = maxMilliseconds;
}

void CapacitiveTouch::calibrate() {
  ctp.calibrateTimeMin = millis();
  ctp.calibrateTimeMax = millis();
}

// Collect the next sensor value
void getNextSensorValue() {
  pinMode(CT_RECEIVE_PIN, INPUT);

  ctp.overflows = 0;
  ctp.pulseDone = false;
  ENABLE_ICU();
  sei();
  digitalWrite(ctp.sendPin, HIGH);
}

#endif