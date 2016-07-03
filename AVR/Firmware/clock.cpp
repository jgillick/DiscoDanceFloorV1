
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/atomic.h>

// Current time -- DO NOT ACCESS DIRECTLY
volatile uint16_t current_time = 0u;

/**
 * Initialize the timer interrupt.
 * Using timer 2 (8-bit)
 */
void start_clock() {
  TIMSK2 |= (1 << OCIE2A);  // Enabled timer
  TCCR2A |= ( 1 << WGM21);  // Timer waveform mode: CTC
  TCCR2B |= (1 << CS22) | (1 << CS21); // Prescaler: 256

  // Fire interrupt every 1ms: (CLK_FREQ * seconds) / TIMER_PRESCALER
  OCR2A = (F_CPU * 1/1000) / 256;

  sei();
}

/**
 * Returns the current time in milliseconds.
 */
volatile uint16_t millis() {
  ATOMIC_BLOCK(ATOMIC_RESTORESTATE){
    return current_time;
  }
}

/**
 * Interrupt to keep the current time in milliseconds.
 */
ISR(TIMER2_COMPA_vect) {
  current_time += 1;
}
