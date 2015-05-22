#include "CapSense2.h"

volatile CapTouchParams captouchparams;

CapacitiveTouch::CapacitiveTouch(int sendPin, int sensorPin)
{
  pinMode(sendPin, OUTPUT);
  pinMode(sensorPin, INPUT);

  captouchparams.sendPin = sendPin;
  captouchparams.sensorPin = sensorPin;

  captouchparams.numSamples = CT_SAMPLE_SIZE;
  captouchparams.calibrateMilliseconds = CT_CAL_TIMEOUT;
  captouchparams.timeoutMilliseconds = CT_SENSE_TIMEOUT;

  captouchparams.sampleIndex = 0;
  captouchparams.filterIndex = 0;
  captouchparams.samplesTotal = 0;
}

void CapacitiveTouch::begin()
{
  // Setup timer interrupt
  cli();
  TCCR2B = (1 << CS20);              // No prescaling
  OCR2A = (16000000 * 5 / 1000000);  // Every 5 microseconds
  TCNT2 = 0;
  TIMSK2 = (1 << OCIE2A);            // Enable timer interupt
  sei();

  // Start collecting data
  calibrate();
  captouchparams.timeoutTime = millis() + captouchparams.timeoutMilliseconds;
  captouchparams.calibrateTime = millis() + captouchparams.calibrateMilliseconds;
}

long CapacitiveTouch::sensorValue()
{
  return captouchparams.value;
}

long CapacitiveTouch::filteredValue()
{
  int len = 0;
  unsigned long sum = 0;
  long median = quickselect((long *)captouchparams.filerValues, CT_FILTER_SIZE, CT_FILTER_SIZE / 2),
       lowVal = median - (median * .15),
       highVal = median + (median * .15),
       value;

  // Add up all values within 15% of the median
  for (int i = 0; i < CT_FILTER_SIZE; i++){
    value = captouchparams.filerValues[i];
    if (value > lowVal && value < highVal) {
      sum += value;
      len++;
    }
  }

  return (sum <= 0) ? sum : sum / len;
}

void CapacitiveTouch::setSampleSize(unsigned int sampleSize)
{
  captouchparams.numSamples = sampleSize;
}

void CapacitiveTouch::setTimeout(unsigned long timeoutMilliseconds)
{
  captouchparams.timeoutMilliseconds = timeoutMilliseconds;
}

void CapacitiveTouch::setCalibrationTimeout(unsigned long calibrateMilliseconds)
{
  captouchparams.calibrateMilliseconds = calibrateMilliseconds;
}

void CapacitiveTouch::calibrate()
{
  captouchparams.baseline = 0x0FFFFFFFL;
}

// TIMER which regularly checks the sensor value
ISR(TIMER2_COMPA_vect)
{

  long now = millis();
  int senseState = digitalRead(captouchparams.sensorPin),
      filter = 0;

  captouchparams.ticks++;

  // State changed
  if (captouchparams.state != senseState)
  {
    captouchparams.state = senseState;

    switch (senseState)
    {
      case HIGH:
        // Reset pins
        pinMode(captouchparams.sensorPin, OUTPUT);
        digitalWrite(captouchparams.sensorPin, HIGH);
        // delayMicroseconds(10);
        pinMode(captouchparams.sensorPin, INPUT);

        // Start discharge
        digitalWrite(captouchparams.sendPin, LOW);
      break;

      case LOW:
        captouchparams.samplesTotal += captouchparams.ticks;

        // Reset samples value
        captouchparams.sampleIndex++;
        if (captouchparams.sampleIndex >= captouchparams.numSamples)
        {
          captouchparams.sampleIndex = 0;

          // Reset baseline if calibrate time has elapsed and samples is less than 10% of baseline
          // so we don't calibrate while the sensor is being touched.
          if (now >= captouchparams.calibrateTime && abs(captouchparams.samplesTotal - captouchparams.baseline) < (int)(.10 * (float)captouchparams.baseline) )
          {
            captouchparams.baseline = 0x0FFFFFFFL;
            captouchparams.calibrateTime = now + captouchparams.calibrateMilliseconds;
          }

          // Update baseline
          if (captouchparams.samplesTotal > 0 && captouchparams.samplesTotal < captouchparams.baseline)
          {
            captouchparams.baseline = captouchparams.samplesTotal;
          }

          // Set value
          filter = 1;
          captouchparams.value = captouchparams.samplesTotal - captouchparams.baseline;
          captouchparams.samplesTotal = 0;
        }

        // Reset
        pinMode(captouchparams.sensorPin, OUTPUT);
        digitalWrite(captouchparams.sensorPin, LOW);
        pinMode(captouchparams.sensorPin, INPUT);

        // Start charge sensor
        captouchparams.ticks = 0;
        captouchparams.timeoutTime = millis() + captouchparams.timeoutMilliseconds;
        digitalWrite(captouchparams.sendPin, HIGH);
      break;
    }
  }
  // Timed out, try again
  else if (now >= captouchparams.timeoutTime)
  {
    // Reset
    digitalWrite(captouchparams.sendPin, LOW);
    pinMode(captouchparams.sensorPin, OUTPUT);
    digitalWrite(captouchparams.sensorPin, LOW);
    pinMode(captouchparams.sensorPin, INPUT);

    // Try again
    filter = 1;
    captouchparams.value = -2;
    captouchparams.ticks = 0;
    captouchparams.timeoutTime = millis() + captouchparams.timeoutMilliseconds;
    digitalWrite(captouchparams.sendPin, HIGH);
  }

  // Add new value to filter array
  if (filter) {
    captouchparams.filerValues[captouchparams.filterIndex++] = captouchparams.value;
    if (captouchparams.filterIndex >= CT_FILTER_SIZE) {
      captouchparams.filterIndex = 0;
    }
  }
}

// Find the element at index k, if the array was sorted.
// From http://www.stat.cmu.edu/~ryantibs/median/quickselect.c
long CapacitiveTouch::quickselect(long *arr, int len, int k) {
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