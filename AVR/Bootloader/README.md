Bootloader
==========

This bootloader will let us program all the nodes on the disco floor bus at once.

This takes the [original multidrop bootloader](https://github.com/jgillick/avr-multidrop-bootloader)
and adds LED status to it.

 * Green - OK
 * Blue - Writing program
 * Red - An error occurred (the bus will retry programming the last page of data.)


 ## Programming

 When using a compatible multidrop programmer ([like this one](https://github.com/jgillick/node-multibootloader))
 you'll set the following values:

  * Baud: 250000
  * Page size: 128 (if you're using an atmega328)
  * Command: `0xF0`