# Disco Dance Floor

![Saturday night fever](http://media.giphy.com/media/MGcPtfsD8L5Kw/giphy.gif)

This project is for a full-size interactive dance floor that can respond to touch and sound.

The floor is made up of individually controlled squares (nodes) attached to a computer via an
RS485 bus. Each node has an Atmega328 with RGB LEDs and a capacitive sensor to detect someone
standing over that cell.

The master controller uses Node.js and provides a simple API that can be used to
write custom floor control programs.

## More information
More information about the build can be found on my page at [hackaday.io](https://hackaday.io/project/4209-interactive-disco-dance-floor).

![Touch sensors](https://cdn.hackaday.io/images/6596951466191934292.gif)
