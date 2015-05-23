#include "CapacitiveTouch.h"

volatile CapTouchParams ctparams;

long CapacitiveTouch::baseline() {
  return ctparams.baseline;
}

CapacitiveTouch::CapacitiveTouch(int sendPin, int sensorPin)
{
  pinMode(sendPin, OUTPUT);
  pinMode(sensorPin, INPUT);

  ctparams.sendPin = sendPin;
  ctparams.sensorPin = sensorPin;

  ctparams.numSamples = CT_SAMPLE_SIZE;
  ctparams.calibrateMilliseconds = CT_CAL_TIMEOUT;
  ctparams.timeoutMilliseconds = CT_SENSE_TIMEOUT;

  ctparams.sampleIndex = 0;
  ctparams.filterIndex = 0;
  ctparams.samplesTotal = 0;
}

void CapacitiveTouch::begin()
{
  // Reset pins
  pinMode(ctparams.sendPin, OUTPUT);
  pinMode(ctparams.sensorPin, INPUT);
  digitalWrite(ctparams.sendPin, LOW);
  delayMicroseconds(10);

  // Calibrate and start charging
  calibrate();
  ctparams.timeoutTime = millis() + ctparams.timeoutMilliseconds;
  digitalWrite(ctparams.sendPin, HIGH);

// If using logic change interrupt
#ifdef CT_WITH_LOGIC_INT
  ctparams.start = 0; // make the first reading a wash for calibration

  // Setup input interrupt
  sei();
  EIMSK |= (1 << INT0);
  EICRA |= (1 << ISC00);
  // TCCR1A = 0 ;           // Normal counting mode
  // TIMSK1 |= _BV(ICIE1);  // enable input capture interrupt
#endif

#ifdef CT_WITH_TIMER_INT
  ctparams.samplesTotal = ctparams.baseline; // make the first reading a wash for calibration

  // Setup timer interrupt
  cli();
  TCCR2B = (1 << CS20);              // No prescaling
  OCR2A = (16000000 * 5 / 1000000);  // Every 5 microseconds
  TCNT2 = 0;
  TIMSK2 = (1 << OCIE2A);            // Enable timer interupt
  sei();
#endif
}

long CapacitiveTouch::sensorValue()
{
  return ctparams.value;
}

long CapacitiveTouch::filteredValue()
{
  int len = 0;
  unsigned long sum = 0;
  long median = quickselect((long *)ctparams.filerValues, CT_FILTER_SIZE, CT_FILTER_SIZE / 2),
       lowVal = median - (median * .15),
       highVal = median + (median * .15),
       value;

  // Add up all values within 15% of the median
  for (int i = 0; i < CT_FILTER_SIZE; i++){
    value = ctparams.filerValues[i];
    if (value > lowVal && value < highVal)
    {
      sum += value;
      len++;
    }
  }

  // Get average
  value = 0;
  if (sum >= 0)
  {
    value = sum/len;
  }

  // Within 1.5% of baseline, return zero
  if (value < (int)(.015 * (float)ctparams.baseline) )
  {
    return 0;
  }
  return value;
}

void CapacitiveTouch::setSampleSize(unsigned int sampleSize)
{
  ctparams.numSamples = sampleSize;
}

void CapacitiveTouch::setTimeout(unsigned long timeoutMilliseconds)
{
  ctparams.timeoutMilliseconds = timeoutMilliseconds;
}

void CapacitiveTouch::setCalibrationTimeout(unsigned long calibrateMilliseconds)
{
  ctparams.calibrateMilliseconds = calibrateMilliseconds;
}

void CapacitiveTouch::calibrate()
{
  ctparams.baseline = 0x0FFFFFFFL;
  ctparams.calibrateTime = millis() + ctparams.calibrateMilliseconds;
}

// Logic interrupt handler
#ifdef CT_WITH_LOGIC_INT
ISR(INT0_vect)
{
  long now;
  int senseState = digitalRead(ctparams.sensorPin);

  if (ctparams.state != senseState)
  {
    ctparams.state = senseState;

    switch (senseState)
    {
      case HIGH:
        ctparams.samplesTotal = micros() - ctparams.start;

        // Reset
        pinMode(ctparams.sensorPin, OUTPUT);
        digitalWrite(ctparams.sensorPin, HIGH);
        pinMode(ctparams.sensorPin, INPUT);

        // Discharge
        ctparams.start = micros();
        digitalWrite(ctparams.sendPin, LOW);
      break;
      case LOW:
        now = millis();
        ctparams.samplesTotal += micros() - ctparams.start;

        // Reset baseline if calibrate time has elapsed and samples is less than 5% of baseline
        // so we don't calibrate while the sensor is being touched.
        if (now >= ctparams.calibrateTime && abs(ctparams.samplesTotal - ctparams.baseline) < (int)(.05 * (float)ctparams.baseline) )
        {
          ctparams.baseline = 0x0FFFFFFFL;
          ctparams.calibrateTime = now + ctparams.calibrateMilliseconds;
        }

        // Update baseline
        if (ctparams.samplesTotal > 0 && ctparams.samplesTotal < ctparams.baseline)
        {
          ctparams.baseline = ctparams.samplesTotal;
        }

        ctparams.value = ctparams.samplesTotal - ctparams.baseline;
        ctparams.samplesTotal = 0;

        // Add new value to filter array
        ctparams.filerValues[ctparams.filterIndex++] = ctparams.value;
        if (ctparams.filterIndex >= CT_FILTER_SIZE)
        {
          ctparams.filterIndex = 0;
        }

        // Reset
        pinMode(ctparams.sensorPin, OUTPUT);
        digitalWrite(ctparams.sensorPin, LOW);
        pinMode(ctparams.sensorPin, INPUT);

        // Charge
        ctparams.start = micros();
        digitalWrite(ctparams.sendPin, HIGH);
    }
  }
}
#endif CT_WITH_LOGIC_INT

// TIMER which regularly checks the sensor value
#ifdef CT_WITH_TIMER_INT
ISR(TIMER2_COMPA_vect)
{

  long now = millis();
  int senseState = digitalRead(ctparams.sensorPin),
      filter = 0;

  ctparams.ticks++;

  // State changed
  if (ctparams.state != senseState)
  {
    ctparams.state = senseState;

    switch (senseState)
    {
      case HIGH:
        // Reset pins
        pinMode(ctparams.sensorPin, OUTPUT);
        digitalWrite(ctparams.sensorPin, HIGH);
        // delayMicroseconds(10);
        pinMode(ctparams.sensorPin, INPUT);

        // Start discharge
        digitalWrite(ctparams.sendPin, LOW);
      break;

      case LOW:
        ctparams.samplesTotal += ctparams.ticks;

        // Reset samples value
        ctparams.sampleIndex++;
        if (ctparams.sampleIndex >= ctparams.numSamples)
        {
          ctparams.sampleIndex = 0;

          // Reset baseline if calibrate time has elapsed and samples is less than 5% of baseline
          // so we don't calibrate while the sensor is being touched.
          if (now >= ctparams.calibrateTime && abs(ctparams.samplesTotal - ctparams.baseline) < (int)(.05 * (float)ctparams.baseline) )
          {
            ctparams.baseline = 0x0FFFFFFFL;
            ctparams.calibrateTime = now + ctparams.calibrateMilliseconds;
          }

          // Update baseline
          if (ctparams.samplesTotal > 0 && ctparams.samplesTotal < ctparams.baseline)
          {
            ctparams.baseline = ctparams.samplesTotal;
          }

          // Set value
          filter = 1;
          ctparams.value = ctparams.samplesTotal - ctparams.baseline;
          ctparams.samplesTotal = 0;
        }

        // Reset
        pinMode(ctparams.sensorPin, OUTPUT);
        digitalWrite(ctparams.sensorPin, LOW);
        pinMode(ctparams.sensorPin, INPUT);

        // Start charge sensor
        ctparams.ticks = 0;
        ctparams.timeoutTime = millis() + ctparams.timeoutMilliseconds;
        digitalWrite(ctparams.sendPin, HIGH);
      break;
    }
  }
  // Timed out, try again
  else if (now >= ctparams.timeoutTime)
  {
    // Reset
    digitalWrite(ctparams.sendPin, LOW);
    pinMode(ctparams.sensorPin, OUTPUT);
    digitalWrite(ctparams.sensorPin, LOW);
    pinMode(ctparams.sensorPin, INPUT);

    // Try again
    filter = 1;
    ctparams.value = -2;
    ctparams.ticks = 0;
    ctparams.timeoutTime = millis() + ctparams.timeoutMilliseconds;
    digitalWrite(ctparams.sendPin, HIGH);
  }

  // Add new value to filter array
  if (filter)
  {
    ctparams.filerValues[ctparams.filterIndex++] = ctparams.value;
    if (ctparams.filterIndex >= CT_FILTER_SIZE)
    {
      ctparams.filterIndex = 0;
    }
  }
}
#endif CT_WITH_TIMER_INT

// Find the element at index k, if the array was sorted.
// From http://www.stat.cmu.edu/~ryantibs/median/quickselect.c
long CapacitiveTouch::quickselect(long *arr, int len, int k)
{
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