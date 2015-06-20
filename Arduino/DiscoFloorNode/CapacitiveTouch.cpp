#include "CapacitiveTouch.h"

volatile CapTouchParams ctp;
void getNextSensorValue();

// Timer interrupt macros
#define ENABLE_TIMER() { \
  TCNT2 = 0; \
  TIMSK2 = (1 << TOIE2); \
}
#define DISABLE_TIMER() TIMSK2 = 0

// Input capture unit macros
#define ENABLE_ICU() { \
  TIMSK1 = 1 << ICIE1 | 1 << TOIE1; \
  TCCR1B |= (1 << CS10); \
  TCCR1A = 0; \
  TCNT1 = 0; \
}
#define DISABLE_ICU() { \
  ctp.overflows = 0; \
  TCCR1B &= ~(1 << CS10); \
  TCNT1 = 0;     \
  TIMSK1 = 0;    \
}

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

  // Prepare timer interrupt
  TCCR2A = 0;
  TCCR2B = (1 << CS22) | (1 << CS21); // 256 prescaling

  // Prepare input capture unit
  ACSR = 0;
  TCCR1B |= (1 << ICNC1); // Noise canceller
  TCCR1B |= (1 << CS10);  // Start timer, prescale by 8
  TCCR1B |= (1 << ICES1); // Trigger on rising edge
  TCCR1A = 0;             // Clear timer state
  TCNT1 = 0;              // Reset timer
  sei();

  // Start
  getNextSensorValue();
}

int32_t CapacitiveTouch::rawValue() {
  return ctp.rawValue;
}

int32_t CapacitiveTouch::sensorValue() {
  return (ctp.valueReady) ? ctp.value : 0;
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
  ctp.baseline = 0x0FFFFFFFL;
  ctp.calibrateTimeMin = millis() + ctp.calibrateMillisecondsMin;
  ctp.calibrateTimeMax = millis() + ctp.calibrateMillisecondsMax;
}

// Overflow interrupt
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

// Input capture interrupt
ISR(TIMER1_CAPT_vect) {
  ctp.pulseTime = ICR1;

  // if just missed an overflow
  uint8_t overflowCopy = ctp.overflows;
  if ((TIFR1 & bit(TOV1)) && ctp.pulseTime < 0x7FFF) {
    overflowCopy++;
  }

  ctp.pulseTime += (overflowCopy << 16);
  ctp.pulseDone = true;

  // Done for now
  DISABLE_ICU();
  ENABLE_TIMER();

  // Discharge
  digitalWrite(ctp.sendPin, LOW);
  pinMode(CT_RECEIVE_PIN, OUTPUT);
  digitalWrite(CT_RECEIVE_PIN, LOW);
}

// Iterrupt timer
ISR(TIMER2_OVF_vect) {
  if (!ctp.pulseDone) return;

  // Stop next timer interrupt while processing
  DISABLE_TIMER();
  sei();

  ctp.rawValue = ctp.pulseTime;
  ctp.gainTotal += ctp.pulseTime;
  ctp.gainIndex++;

  if (ctp.gainIndex > ctp.gain) {
    // Serial.println(ctp.gainTotal);

    // Kalman filter adapted from:
    // http://interactive-matter.eu/blog/2009/12/18/filtering-sensor-data-with-a-kalman-filter/
    ctp.p = ctp.p + ctp.q;
    ctp.k = ctp.p / (ctp.p + ctp.r);
    ctp.x = ctp.x + ctp.k * (ctp.gainTotal - ctp.x);
    ctp.p = (1 - ctp.k) * ctp.p;

    // Reset gain
    ctp.gainIndex = 0;
    ctp.gainTotal = 0;

    // It takes about 50 samples for the value to be stable
    if (!ctp.valueReady) {
      ctp.sampleIndex++;
      if (ctp.sampleIndex >= 50) {
        ctp.valueReady = true;
      }
    }

    // Process value and baseline
    else {
      uint32_t now = millis();

      // Update baseline
      if (ctp.x < ctp.baseline) {
        ctp.baseline = ctp.x;
      }
      // Calibrate baseline, if sensor is not being touched
      else if (now >= ctp.calibrateTimeMin && abs(ctp.x - ctp.baseline) < (CT_THRESHOLD_PERCENT * ctp.baseline)) {
        ctp.baseline = ctp.x;
        ctp.calibrateTimeMin = now + ctp.calibrateMillisecondsMin;
        ctp.calibrateTimeMax = now + ctp.calibrateMillisecondsMax;
      }
      // Force calibration
      else if (now >= ctp.calibrateTimeMax) {
        ctp.baseline = ctp.x;
        ctp.calibrateTimeMin = now + ctp.calibrateMillisecondsMin;
        ctp.calibrateTimeMax = now + ctp.calibrateMillisecondsMax;
      }
      ctp.value = ctp.x - ctp.baseline;
    }
  }

  // Start all over again
  getNextSensorValue();
}

// Collect the next sensor value
void getNextSensorValue() {
  pinMode(CT_RECEIVE_PIN, INPUT);

  ctp.overflows = 0;
  ctp.pulseDone = false;
  ENABLE_ICU();
  digitalWrite(ctp.sendPin, HIGH);
}
