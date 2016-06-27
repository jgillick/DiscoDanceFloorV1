import { Component, OnInit } from '@angular/core';

import { SerialConnectService } from '../services/serial-connect.service';

@Component({
  templateUrl: './html/connect.html',
})
export class ConnectComponent implements OnInit {

  deviceList:string[] = [];

  constructor( private _serial:SerialConnectService ) {
  }

  ngOnInit() {
    this._updateDeviceList();
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
