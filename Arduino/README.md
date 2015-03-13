
ATMega168
==========

Fuse bits
---------

You need to set the fuse bits before it will run at the proper speed.
(For external osc, disable clode divide by 8, brownout 2.7V, enable SPI, brown-out disabled)

    avrdude -p m168 -c usbtiny -e -U lfuse:w:0xff:m -U hfuse:w:0xdd:m -U efuse:w:0x00:m



ATtiny2313
==========

Arduino 1.0.x Core
----------------
To program the Attiny on Ardiuno 1.0.x, use [this core](http://toasterbotics.blogspot.com/2011/08/attiny2313-with-arduino.html).

Arduino 1.5 Core
----------------
To program the Attiny on Ardiuno 1.5, use [this core](http://www.leonardomiliani.com/en/2014/aggiornato-il-core-attiny-per-lide-1-5-8-di-arduino/).

Fuse bits
---------

You need to set the fuse bits before it will run at the proper speed.
(For external osc, disable clode divide by 8, enable SPI, brown-out disabled)

    avrdude -p t2313 -c usbtiny -e -U lfuse:w:0xff:m -U hfuse:w:0xdf:m -U efuse:w:0xff:m

