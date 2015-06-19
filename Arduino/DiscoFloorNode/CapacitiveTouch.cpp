#include "CapacitiveTouch.h"

volatile CapTouchParams ctp;
void getNextSensorValue();

#define ENABLE_TIMER() { \
  TCNT2 = 0; \
  TIMSK2 = (1 << TOIE2); \
}
#define DISABLE_TIMER() TIMSK2 = 0

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

CapacitiveTouch::CapacitiveTouch(int8_t sendPin, int8_t sensorPin) {
  pinMode(sendPin, OUTPUT);
  pinMode(sensorPin, INPUT);

  ctp.sendPin = sendPin;
  ctp.sensorPin = sensorPin;

  setSampleSize(CT_SAMPLE_SIZE);
  setCalibrationTimeout(CT_CAL_TIMEOUT_MIN, CT_CAL_TIMEOUT_MAX);
  baselineTuning(CT_BASELINE_LIMIT, CT_BASELINE_SMOOTH);

  ctp.sampleIndex = 0;
}

void CapacitiveTouch::begin() {
  ctp.valueReady = false;
  calibrate();

  // Reset pins
  pinMode(ctp.sendPin, OUTPUT);
  pinMode(ctp.sensorPin, INPUT);
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

int32_t CapacitiveTouch::sensorValue() {
  return (ctp.valueReady) ? ctp.value : 0;
}

int32_t CapacitiveTouch::baseline() {
  return ctp.baseline;
}

void CapacitiveTouch::setSampleSize(uint8_t sampleSize) {
  ctp.numSamples = sampleSize;
}

void CapacitiveTouch::setCalibrationTimeout(uint32_t minMilliseconds) {
  ctp.calibrateMillisecondsMin = minMilliseconds;
}
void CapacitiveTouch::setCalibrationTimeout(uint32_t minMilliseconds, uint32_t maxMilliseconds) {
  setCalibrationTimeout(minMilliseconds);
  ctp.calibrateMillisecondsMax = maxMilliseconds;
}

void CapacitiveTouch::baselineTuning(float limit, float smoothing) {
  ctp.baselineLimit = limit;
  ctp.baselineSmoothing = smoothing;
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
    pinMode(ctp.sensorPin, OUTPUT);
    digitalWrite(ctp.sensorPin, LOW);
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
  pinMode(ctp.sensorPin, OUTPUT);
  digitalWrite(ctp.sensorPin, LOW);
}

// Iterrupt timer
ISR(TIMER2_OVF_vect) {
  if (!ctp.pulseDone) return;

  // Stop next timer interrupt while processing
  DISABLE_TIMER();
  sei();

  // Add samples to array
  ctp.samples[ctp.sampleIndex++] = ctp.pulseTime;
  if (ctp.sampleIndex == CT_SAMPLE_SIZE) {
    ctp.sampleIndex = 0;
    ctp.valueReady = true;
  }

  // Filter samples array
  if (ctp.valueReady) {
    uint32_t sum = 0,
             now = millis();

    for (int i = 0; i < CT_SAMPLE_SIZE; i++){
      sum += ctp.samples[i];
    }

    // Update baseline
    if (sum < ctp.baseline) {
      ctp.baseline = sum;
    }
    // Calibrate baseline, if sensor is not being touched
    else if (now >= ctp.calibrateTimeMin && abs(sum - ctp.baseline) < (0.05 * ctp.baseline)) {
      ctp.baseline = sum;
      ctp.calibrateTimeMin = now + ctp.calibrateMillisecondsMin;
    }
    ctp.value = sum - ctp.baseline;
  }

  // Start all over again
  getNextSensorValue();
}


// Collect the next sensor value
void getNextSensorValue() {
  pinMode(ctp.sensorPin, INPUT);

  ctp.overflows = 0;
  ctp.pulseDone = false;
  ENABLE_ICU();
  digitalWrite(ctp.sendPin, HIGH);
}

// Set the sensor value
void setValue(uint32_t rawValue) {
  uint32_t now = millis();

  // Update baseline
  if (rawValue < ctp.baseline) {
    ctp.baseline = rawValue;
  }
  // Dynamically calibrate baseline, if it's not being tripped
  else if (rawValue > 0 && abs(rawValue - ctp.baseline) < (ctp.baselineLimit * ctp.baseline)) {

    // If value is within x% of baseline
    if(rawValue < ctp.baseline || abs(rawValue - ctp.baseline) < ctp.baselineSmoothing * ctp.baseline) {
      ctp.baseline = rawValue;
    }

    // Recalibrate
    else if (now >= ctp.calibrateTimeMin) {
      ctp.baseline = rawValue;
      ctp.calibrateTimeMin = now + ctp.calibrateMillisecondsMin;
      ctp.calibrateTimeMax = now + ctp.calibrateMillisecondsMax;
    }
  }
  // Forced recalibration
  else if (now >= ctp.calibrateTimeMax) {
    ctp.baseline = rawValue;
    ctp.calibrateTimeMin = now + ctp.calibrateMillisecondsMin;
    ctp.calibrateTimeMax = now + ctp.calibrateMillisecondsMax;
  }

  // Set value
  ctp.value = rawValue - ctp.baseline;
}