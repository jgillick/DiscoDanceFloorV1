
/*****************************************************************************
*
* Lights up LEDs to display the current programming status.
*
******************************************************************************/


#ifndef STATUS_H
#define STATUS_H

// Turn all the status LEDs off
extern void resetStatus();

// Setup the status LEDs
extern void statusSetup();

// Set the status to writing
extern void statusWriting();

// Set the status to Ok
extern void statusOk();

// Set the status to error
extern void statusError();

#endif
