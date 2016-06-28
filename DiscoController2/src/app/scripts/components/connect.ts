import { Component, OnInit } from '@angular/core';

import { SerialConnectService } from '../services/serial-connect.service';
import { BusProtocolService } from '../services/bus-protocol.service';

@Component({
  templateUrl: './html/connect.html',
})
export class ConnectComponent implements OnInit {

  deviceList:string[] = [];
  
  form:any;
  selectedDevice:string = null;

  // Skip readdressing nodes when connecting
  keepAddresses:boolean = false;

  constructor(
    private _serial:SerialConnectService, 
    private _bus:BusProtocolService) {
  }

  ngOnInit() {
    this._updateDeviceList();
  }

  /**
   * Connect to the selected device.
   */
  connect() {
    if (!this.selectedDevice) {
      return;
    }

    this._serial.connect(this.selectedDevice)
    .then(() => {
      this._bus.connect();
      this._bus.startAddressing()
      .subscribe(
        (n) => console.log('Added', n),
        (err) => console.error('Error', err),
        () => console.log('Done!')
      );
    },
    console.log);
  }

  /**
   * Update the list of connected USB devices.
   */
  private _updateDeviceList() {
    this._serial.getDevices().then( (devices:string[]) => {
      this.deviceList = devices;

      // Update list every 2000ms
      setTimeout(this._updateDeviceList.bind(this), 2000);
    });
  }
}
