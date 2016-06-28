/**
 * This service facilitates all the messages to and from the floor.
 */

import { SerialConnectService } from './serial-connect.service';
import { BusProtocolService } from './bus-protocol.service';

export class CommunicationService {

  constructor(
    private _serial:SerialConnectService,  
    private _bus:BusProtocolService ) {

  }
}