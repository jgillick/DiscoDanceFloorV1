import { Component, OnInit } from '@angular/core';

import { StorageService } from '../services/storage.service';
import { CommunicationService } from '../services/communication.service';
import { FloorBuilderService } from '../services/floor-builder.service';

@Component({
  templateUrl: './html/connect.html',
  styleUrls: ['./styles/connect.css']
})
export class ConnectComponent implements OnInit {

  deviceList:string[] = [];
  
  nodes:number = 0;
  connecting:boolean = false;
  disconnecting:boolean = false;
  selectedDevice:string = null;

  // Skip readdressing nodes when connecting
  keepAddresses:boolean = false;

  constructor(
    private _comm:CommunicationService,
    private _storage:StorageService,
    private _floorBuilder:FloorBuilderService) {
  }

  ngOnInit() {
    this._updateDeviceList();

    this.selectedDevice = this._storage.getItem("connection.device");
    this.keepAddresses = this._storage.getItem("connection.keepAddresses");
  }

  /**
   * Connect to the selected device.
   */
  connect() {
    if (!this.selectedDevice) {
      alert("You haven't selected a device");
      return;
    }

    this._storage.setItem("connection.device", this.selectedDevice);
    this._storage.setItem("connection.keepAddresses", this.keepAddresses);

    // Connect to the device
    this.nodes = 0;
    this.connecting = true;
    this._comm.connect(this.selectedDevice)
    .then(() => {
      
      if (this.keepAddresses) {
        this.connecting = false;
        this._comm.bus.nodeNum = this._storage.getItem("connection.numNodes") || 0;
        this._comm.run();
      }
      else {
        this._addressNodes();
      }

    },
    (err) => alert('Error connecting: '+ err));
  }

  /**
   * Disconnect from the current device
   */
  disconnect():void {
    if (!this.isConnected()) {
      return;
    }

    this.disconnecting = true;
    this._comm.disconnect()
    .then(() => this.disconnecting = false)
    .catch(() => this.disconnecting = false);
  }

  /**
   * True if we're currently connected to the floor.
   */
  isConnected() {
    return this._comm.isConnected();
  }

  /**
   * The number of nodes we are connected to.
   */
  nodeNum(): number {
    return this._comm.bus.nodeNum;
  }

  /**
   * Address all the nodes
   */
  private _addressNodes() {
    this._comm.assignAddresses()
    .subscribe(
      // Next value
      (n) => {
        this.nodes = n
      }, 
      // Error
      (err) => {
        alert('Error addressing nodes '+ err);
        console.error(err);
        this.connecting = false;
      },
      // Done
      () => {
        this.connecting = false;
        this._rebuildFloor();
        this._comm.run();
      }
    );
  }

  /**
   * After addressing nodes, rebuild the floor
   */
  private _rebuildFloor(): void {
    this._storage.setItem("connection.numNodes", this._comm.bus.nodeNum);
    let dimensions = this._storage.getItem('settings.dimensions');
    this._floorBuilder.build(
      this._comm.bus.nodeNum,
      dimensions.x,
      dimensions.y
    );
  }

  /**
   * Update the list of connected USB devices.
   */
  private _updateDeviceList() {
    this._comm.getDevices().then( (devices:string[]) => {
      this.deviceList = devices;

      // Update list every 2000ms
      setTimeout(this._updateDeviceList.bind(this), 1000);
    });
  }
}
