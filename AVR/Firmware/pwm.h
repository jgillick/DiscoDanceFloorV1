/**
 * Provides helper methods to setup use the PWM lines for the RGB LEDs.
 */

#ifndef PWM_H
#define PWM_H

// Red LED PWM settings.
void red_pwm_init() {
  DDRD   |= (1 << PD6);
  TCCR0A |= (1 << COM0A1); // Compare output mode: PWM
  TCCR0A |= (1 << WGM00);  // Waveform generator: PWM phase correct
  TCCR0B |= (1 << CS00);   // No prescaler
}

// Green LED PWM settings.
void green_pwm_init() {
  DDRD   |= (1 << PD5);
  TCCR0A |= (1 << COM0B1); // Compare output mode: PWM
  TCCR0A |= (1 << WGM00);  // Waveform generator: PWM phase correct
  TCCR0B |= (1 << CS00);   // No prescaler
}

// Blue LED PWM settings.
void blue_pwm_init() {
  DDRB   |= (1 << PB1); 
  TCCR1A |= (1 << COM1A1); // Compare output mode: PWM
  TCCR1A |= (1 << WGM10);  // PWM, Phase Correct, 8-bit
  TCCR1B |= (1 << CS10);   // No prescaler 
}

// Setup all three LEDs
void pwm_init() {
  red_pwm_init();
  green_pwm_init();
  blue_pwm_init();
}

// Set the red PWM value
inline void red_pwm(uint8_t value) {
  OCR0A = value;
}

// Set the green PWM value
inline void green_pwm(uint8_t value) {
  OCR0B = value;
}

// Set the blue PWM value
inline void blue_pwm(uint8_t value) {
  OCR1A = value;
}

#endif
