Disco Floor Node
================

Code for a single dance floor node. It handles sending and 
receiving message via RS485 to and from the master node.

For a simple test setup, you can make one of the nodes the "master"
by bringing pin 5 high. This node will then run the network through
a node registration and a series of simple programs.

Wiring
=======

Arduino
--------

```
0:   To pin 1 of RS485 chip (RO)
1:   To pin 4 of RS485 chip (DI)
2:   To '-' for nodes, '+' for master
4:   To pin 6 of next node
6:   From pin 4 of the previous node or master
7:   To blue pin of RGB LED
8:   To red pin of RGB LED
9:   To green pin of RGB LED
10:  To both TX/RX enable pins of RS485 chip (pins 2 & 3)
12:  (master only, optional) Attach to pin 13 of either node to receive debugging statements
13:  (optional) Attach to master's pin 12, for debugging statements.
```

RS485 chip (MAX485 or ISL8487E)
-------------------------------
Wire pins 2 & 3 together and then to pin 10 of floor node. 

```
1:   To pin 0 (RX) of floor node
2:   To pin 10 of floor node
3:   To pin 10 of floor node
4:   To pin 1 (TX) of floor node
5:   To 5V
6:   Bus A/Y
7:   Bus B/Z
8:   To common
```

I'm using the [Intersil ISL8487E](http://www.digikey.com/product-detail/en/ISL8487EIBZ/ISL8487EIBZ-ND/1034816) chip 
which is pin compatible with MAS485, but cheaper.

Debugging
=========
All nodes output serial debugging statements to pin 13 (4800 baud). If pin 12 of the master node is
connected to this pin, it will dump these statements out to serial.