
#include "RGBFade.h"

#define STEP_TIME 12.0 // Number of milliseconds per step (max = 200)

// Handy array indexes
#define R 0
#define G 1
#define B 2

// Timer interrupt macros
#define ENABLE_TIMER() { \
  TCCR1A = 0; \
  TIMSK1 |= (1 << OCIE1A); \
}
#define DISABLE_TIMER() TIMSK1 = 0

/*
* PWM Macros
*/

// Red - PD5 (OC0B)
#define RED_PWM_SETUP() { \
  DDRD |= (1 << PD5); \
  PORTD &= ~(1 << PD5); \
}
#define RED_PWM(val) { \
  TCCR0A &= ~(1 << COM0B1); \
  if (val == 0) PORTD &= ~(1 << PD5); \
  else if (val == 255) PORTD |= (1 << PD5); \
  else TCCR0A |= (1 << COM0B1); OCR0B = val; \
}

// Green - PD6 (OC0A)
#define GREEN_PWM_SETUP() { \
  DDRD |= (1 << PD6); \
  PORTD &= ~(1 << PD6); \
}
#define GREEN_PWM(val) { \
  TCCR0A &= ~(1 << COM0A1); \
  if (val == 0) PORTD &= ~(1 << PD6); \
  else if (val == 255) PORTD |= (1 << PD6); \
  else { TCCR0A |= (1 << COM0A1); OCR0A = val; } \
}

// Blue - PD3 (OC2B)
#define BLUE_PWM_SETUP() { \
  DDRD |= (1 << PD3); \
  PORTD &= ~(1 << PD3); \
}
#define BLUE_PWM(val) { \
  TCCR2A &= ~(1 << COM2B1); \
  if (val == 0) PORTD &= ~(1 << PD3); \
  else if (val == 255) PORTD |= (1 << PD3); \
  else TCCR2A |= (1 << COM2B1); OCR2B = val; \
}

volatile RGBFadeParams params;

// Timer interrupt to adjust the PWM value every STEP_TIME ms
ISR(TIMER1_COMPA_vect) {
  if (!params.fading) return;

  DISABLE_TIMER();
  sei();

  // Update LEDs
  bool fading = false;
  uint8_t pwm;
  for (int i = 0; i< 3; i++) {

    // Increment
    if (params.increment[i] != 0) {
      params.color[i] += params.increment[i];

      // Fade complete
      if ((params.increment[i] > 0 && params.color[i] >= params.targetColor[i])
          || (params.increment[i] < 0 && params.color[i] <= params.targetColor[i])) {
        params.increment[i] = 0;
        params.color[i] = params.targetColor[i];
      }
      else {
        fading = true;
      }

      // Update PWM value
      params.pwm[i] = round(params.color[i]);
    }
  }

  // Update PWMs
  RED_PWM(params.pwm[R]);
  GREEN_PWM(params.pwm[G]);
  BLUE_PWM(params.pwm[B]);

  // Still fading?
  params.fading = fading;
  if (fading) {
    ENABLE_TIMER();
  }
}

RGBFade::RGBFade() {
  params.fading = false;
  params.color[R] = 0;
  params.color[G] = 0;
  params.color[B] = 0;
}

void RGBFade::begin() {

  // Setup fade timer, but don't start until a fade is set
  TCCR1A = 0;
  TCCR1B = 0;
  OCR1A = round(F_CPU / 64 * STEP_TIME / 1000); // timer count
  TCCR1B |= (1 << CS11) | (1 << CS10); // prescale by 64
  TCCR1B |= (1 << WGM12); // turn on CTC mode

  RED_PWM_SETUP();
  GREEN_PWM_SETUP();
  BLUE_PWM_SETUP();

  sei();
}

bool RGBFade::isFading() {
  return params.fading;
}

void RGBFade::stopFade() {
  params.fading = false;
  DISABLE_TIMER();
}

void RGBFade::fadeTo(uint8_t red, uint8_t green, uint8_t blue, uint32_t time) {
  stopFade();

  params.targetColor[R] = red;
  params.targetColor[G] = green;
  params.targetColor[B] = blue;

  // Calculate how many PWM units per millisecond
  int diff;
  for (int i = 0; i< 3; i++) {
    diff = params.targetColor[i] - params.color[i];

    if (diff == 0) {
      params.increment[i] = 0;
    }
    else {
      params.increment[i] = (STEP_TIME * diff) / (float)time;
    }
  }

  ENABLE_TIMER();
  params.fading = true;
}

void RGBFade::setColor(uint8_t red, uint8_t green, uint8_t blue) {
  stopFade();

  params.pwm[R] = red;
  params.color[R] = red;
  params.targetColor[R] = red;
  RED_PWM(red);

  params.pwm[G] = green;
  params.color[G] = green;
  params.targetColor[G] = green;
  GREEN_PWM(green);

  params.pwm[B] = blue;
  params.color[B] = blue;
  params.targetColor[B] = blue;
  BLUE_PWM(blue);
}

uint8_t* RGBFade::getColor() {
  return (uint8_t*)params.pwm;
}

uint8_t* RGBFade::getTargetColor() {
  return (uint8_t*)params.targetColor;
}