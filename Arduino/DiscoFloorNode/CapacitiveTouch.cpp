#include "CapacitiveTouch.h"

volatile CapTouchParams ctp;
void addValue(uint32_t rawValue);
long quickselect(long *arr, int len, int k);

long CapacitiveTouch::baseline() {
  return ctp.baseline;
}

CapacitiveTouch::CapacitiveTouch(int sendPin, int sensorPin) {
  pinMode(sendPin, OUTPUT);
  pinMode(sensorPin, INPUT);

  ctp.sendPin = sendPin;
  ctp.sensorPin = sensorPin;

  ctp.threshold = CT_THRESHOLD_PERCENT;
  ctp.numSamples = CT_SAMPLE_SIZE;
  ctp.timeoutMilliseconds = CT_SENSE_TIMEOUT;
  ctp.calibrateMillisecondsMin = CT_CAL_TIMEOUT_MIN;
  ctp.calibrateMillisecondsMax = CT_CAL_TIMEOUT_MAX;

  ctp.sampleIndex = 0;
  ctp.filterIndex = 0;
  ctp.samplesTotal = 0;
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

// If using logic change interrupt
#ifdef CT_WITH_LOGIC_INT
  ctp.start = 0; // make the first reading a wash for calibration

  // Setup input interrupt
  sei();
  EIMSK |= (1 << INT0);
  EICRA |= (1 << ISC00);
  // TCCR1A = 0 ;           // Normal counting mode
  // TIMSK1 |= _BV(ICIE1);  // enable input capture interrupt
#endif

#ifdef CT_WITH_TIMER_INT
  ctp.samplesTotal = ctp.baseline; // make the first reading a wash for calibration

  // Setup timer interrupt
  cli();
  TCCR2B = (1 << CS20);              // No prescaling
  OCR2A = (16000000 * 5 / 1000000);  // Every 5 microseconds
  TCNT2 = 0;
  TIMSK2 = (1 << OCIE2A);            // Enable timer interupt
  sei();
#endif
}

long CapacitiveTouch::sensorValue() {
  return ctp.value;
}

long CapacitiveTouch::filteredValue() {
  int len = 0;
  unsigned long sum = 0;
  long median = quickselect((long *)ctp.filerValues, CT_FILTER_SIZE, CT_FILTER_SIZE / 2),
       lowVal = median - (median * .15),
       highVal = median + (median * .15),
       value;

  return median;

  // Add up all values within 15% of the median
  for (int i = 0; i < CT_FILTER_SIZE; i++){
    value = ctp.filerValues[i];
    if (value > lowVal && value < highVal) {
      sum += value;
      len++;
    }
  }

  // Get average
  value = 0;
  if (sum >= 0) {
    value = sum/len;
  }

  // Anything below the threshold is 0
  if (value < (int)(ctp.threshold * (float)ctp.baseline) ) {
    return 0;
  }
  return value;
}

void CapacitiveTouch::setSampleSize(unsigned int sampleSize) {
  ctp.numSamples = sampleSize;
}

void CapacitiveTouch::setTimeout(unsigned long timeoutMilliseconds) {
  ctp.timeoutMilliseconds = timeoutMilliseconds;
}

void CapacitiveTouch::setCalibrationTimeout(unsigned long calibrateMilliseconds) {
  ctp.calibrateMillisecondsMin = calibrateMilliseconds;
}

void setMaxCalibrationTimeout(unsigned long calibrateMilliseconds) {
  ctp.calibrateMillisecondsMax = calibrateMilliseconds;
}

void CapacitiveTouch::setThreshold(float percent) {
  ctp.threshold = percent;
}

void CapacitiveTouch::calibrate() {
  ctp.baseline = 0;
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
        ctp.samplesTotal += ctp.ticks;
        ctp.sampleIndex++;

        // Collected all samples, process
        if (ctp.sampleIndex >= ctp.numSamples) {
          addValue(ctp.samplesTotal);
          ctp.samplesTotal = 0;
          ctp.sampleIndex = 0;
        }

        // Reset
        pinMode(ctp.sensorPin, OUTPUT);
        digitalWrite(ctp.sensorPin, LOW);
        pinMode(ctp.sensorPin, INPUT);

        // Start charge sensor
        ctp.ticks = 0;
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
    addValue(-200);

    // Try again
    ctp.sampleIndex = 0;
    ctp.samplesTotal = 0;
    ctp.ticks = 0;
    ctp.timeoutTime = millis() + ctp.timeoutMilliseconds;
    digitalWrite(ctp.sendPin, HIGH);
  }
}
#endif CT_WITH_TIMER_INT

void addValue(uint32_t rawValue) {
  uint32_t now = millis();

  // Update baseline
  if (rawValue < ctp.baseline || ctp.baseline == 0) {
    ctp.baseline = rawValue;
  }
  // Dynamically calibrate baseline, if it's not being tripped
  else if (rawValue > 0 && abs(rawValue - ctp.baseline) < (CT_BASELINE_LIMIT * ctp.baseline)) {

    // If value is within x% of baseline
    if(rawValue < ctp.baseline || abs(rawValue - ctp.baseline) < CT_BASELINE_SMOOTH * ctp.baseline) {
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

  // Add to filter array
  ctp.filerValues[ctp.filterIndex++] = ctp.value;
  if (ctp.filterIndex >= CT_FILTER_SIZE) {
    ctp.filterIndex = 0;
  }
}

// Find the element at index k, if the array was sorted.
// From http://www.stat.cmu.edu/~ryantibs/median/quickselect.c
long quickselect(long *arr, int len, int k) {
  unsigned long i,ir,j,l,mid;
  long a,temp;

  l=0;
  ir= len - 1;
  for(;;) {
    if (ir <= l+1) {
      if (ir == l+1 && arr[ir] < arr[l]) {
        SWAP(arr[l],arr[ir]);
      }
      return arr[k];
    }
    else {
      mid=(l+ir) >> 1;
      SWAP(arr[mid],arr[l+1]);
      if (arr[l] > arr[ir]) {
        SWAP(arr[l],arr[ir]);
      }
      if (arr[l+1] > arr[ir]) {
        SWAP(arr[l+1],arr[ir]);
      }
      if (arr[l] > arr[l+1]) {
        SWAP(arr[l],arr[l+1]);
      }
      i=l+1;
      j=ir;
      a=arr[l+1];
      for (;;) {
        do i++; while (arr[i] < a);
        do j--; while (arr[j] > a);
        if (j < i) break;
        SWAP(arr[i],arr[j]);
      }
      arr[l+1]=arr[j];
      arr[j]=a;
      if (j >= k) ir=j-1;
      if (j <= k) l=i;
    }
  }
}