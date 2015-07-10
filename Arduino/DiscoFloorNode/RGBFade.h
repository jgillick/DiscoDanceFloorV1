
#ifndef RGBFade_h
#define RGBFade_h

#include <Arduino.h>
#include <avr/interrupt.h>

class RGBFade {
private:

public:
  RGBFade();

  // Begin fade timer
  void begin();

  // Fade to a color in at least `time` number of milliseconds
  void fadeTo(uint8_t red, uint8_t green, uint8_t blue, uint32_t time);

  // Immediately set the color
  void setColor(uint8_t red, uint8_t green, uint8_t blue);

  // Get the current color as an array of Red, Green, Blue
  uint8_t* getColor();

  // If fading, get the target color we're fading to
  uint8_t* getTargetColor();

  // True if there is a fade in progress
  bool isFading();

  // Stop the current fade
  void stopFade();
};

struct RGBFadeParams {
  bool fading;

  float increment[3],
        color[3];

  uint8_t pwm[3],
          targetColor[3];
};

#endif RGBFade_h