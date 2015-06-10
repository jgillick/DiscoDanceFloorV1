#include "CapacitiveTouch.h"

volatile CapTouchParams ctp;
void setValue(uint32_t rawValue);

CapacitiveTouch::CapacitiveTouch(int8_t sendPin, int8_t sensorPin) {
  pinMode(sendPin, OUTPUT);
  pinMode(sensorPin, INPUT);

  ctp.sendPin = sendPin;
  ctp.sensorPin = sensorPin;

  setSampleSize(CT_SAMPLE_SIZE);
  setTimeout(CT_SENSE_TIMEOUT);
  setCalibrationTimeout(CT_CAL_TIMEOUT_MIN, CT_CAL_TIMEOUT_MAX);
  baselineTuning(CT_BASELINE_LIMIT, CT_BASELINE_SMOOTH);

  ctp.sampleIndex = 0;
}

void CapacitiveTouch::begin() {
  // Reset pins
  pinMode(ctp.sendPin, OUTPUT);
  pinMode(ctp.sensorPin, INPUT);
  digitalWrite(ctp.sendPin, LOW);
  delayMicroseconds(10);

  // Calibrate and start charging
  calibrate();
  ctp.timeoutTime = millis() + ctp.timeoutMilliseconds;
  digitalWrite(ctp.sendPin, HIGH);

#ifdef CT_WITH_TIMER_INT

  // Setup timer interrupt
  cli();
  TCCR2B = (1 << CS20);              // No prescaling
  OCR2A = (16000000 * 5 / 1000000);  // Every 5 microseconds
  TCNT2 = 0;
  TIMSK2 = (1 << OCIE2A);            // Enable timer interupt
  sei();
#endif
}

int32_t CapacitiveTouch::sensorValue() {
  return ctp.value;
}

int32_t CapacitiveTouch::baseline() {
  return ctp.baseline;
}

void CapacitiveTouch::setSampleSize(uint8_t sampleSize) {
  ctp.numSamples = sampleSize;
}

void CapacitiveTouch::setTimeout(uint32_t timeoutMilliseconds) {
  ctp.timeoutMilliseconds = timeoutMilliseconds;
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

// TIMER which regularly checks the sensor value
#ifdef CT_WITH_TIMER_INT
ISR(TIMER2_COMPA_vect) {

  uint32_t now = millis();
  uint8_t  senseState = digitalRead(ctp.sensorPin);

  ctp.ticks++;

  // State changed
  if (ctp.state != senseState) {
    ctp.state = senseState;

    switch (senseState) {
      case HIGH:
        // Reset pins
        pinMode(ctp.sensorPin, OUTPUT);
        digitalWrite(ctp.sensorPin, HIGH);
        pinMode(ctp.sensorPin, INPUT);

        // Start discharge
        digitalWrite(ctp.sendPin, LOW);
      break;

      case LOW:
        ctp.sampleIndex++;

        // Collected all samples, process
        if (ctp.sampleIndex >= ctp.numSamples) {
          setValue(ctp.ticks);
          ctp.ticks = 0;
          ctp.sampleIndex = 0;
        }

        // Reset
        pinMode(ctp.sensorPin, OUTPUT);
        digitalWrite(ctp.sensorPin, LOW);
        pinMode(ctp.sensorPin, INPUT);

        // Start charge sensor
        // ctp.ticks = 0;
        ctp.timeoutTime = millis() + ctp.timeoutMilliseconds;
        digitalWrite(ctp.sendPin, HIGH);
      break;
    }
  }
  // Timed out, try again
  else if (now >= ctp.timeoutTime) {

    // Reset
    digitalWrite(ctp.sendPin, LOW);
    pinMode(ctp.sensorPin, OUTPUT);
    digitalWrite(ctp.sensorPin, LOW);
    pinMode(ctp.sensorPin, INPUT);

    // Log value
    setValue(-200);

    // Try again
    ctp.sampleIndex = 0;
    ctp.ticks = 0;
    ctp.timeoutTime = millis() + ctp.timeoutMilliseconds;
    digitalWrite(ctp.sendPin, HIGH);
  }
}
#endif CT_WITH_TIMER_INT

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