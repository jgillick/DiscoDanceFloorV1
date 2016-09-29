/**
 * Keeps the currrent time in milliseconds.
 * This uses Timer 2 to keep track of time.
 */

#ifndef CLOCK_H
#define CLOCK_H

// Start the clock
void start_clock();

// Return the current millisecond count
volatile uint16_t millis();

#endif
