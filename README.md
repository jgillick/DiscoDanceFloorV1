# Disco Dance Floor

A computer controlled interactive disco dance floor built for the 2015 Burning Man Roller Disco camp.

The floor will be made up of individually controlled squares (nodes) attached to a computer
via an RS485 bus. Each node has an Atmega168 (running Arduino bootloader) with RGB LEDs and a capacitive sensor
used to detect if someone is standing over that cell.

The computer controller uses Node.js and provides a simple API that can be used to
write custom floor control programs.

## More information
There is more information in the README files under the Arduino and Disco Controller folders.

![Saturday night fever](http://media.giphy.com/media/MGcPtfsD8L5Kw/giphy.gif)