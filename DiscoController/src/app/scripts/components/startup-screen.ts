/**
 * Shows the splash screen and handles auto-start functionality
 */

import { Component } from '@angular/core';
import { Router } from '@angular/router';

import {StorageService} from '../services/storage.service';
import {CommunicationService} from '../services/communication.service';
import {ProgramControllerService} from '../services/program-controller.service';

@Component({
  selector: 'startup-screen',
  templateUrl: './html/startup-screen.html',
  styleUrls: ['./styles/startup-screen.css'],
})
export class StartupScreenComponent {

  private _autoConn:boolean = false;
  private _autoPlay:boolean = false;

  constructor(
    private _router:Router,
    private _storage:StorageService,
    private _programService:ProgramControllerService,
    private _comm:CommunicationService) {

    this._autoPlay = (this._storage.getItem('settings.autoPlay') === true);
    this._autoConn = (this._storage.getItem('settings.autoConnect') === true);
    this.autoStartup();
  }
  /**
   * Check if we should automatically connect and/or play programs
   */
  autoStartup(): void {

    if (this._autoConn) {
      this.autoConnect();
    }

    else if (this._autoPlay) {
      this._programService.playNext();
      this._router.navigate(['/floor']);
    }

    else {
      this._router.navigate(['/floor']);
    }
  }

  /**
   * Automatically connect to the first known connected device
   */
  autoConnect(): void {
    this._comm.getKnownDevices().then( (known) => {
      if (known.length) {
        this._comm.connect(known[0])
        .then(() => {

          // Use the same node addresses as last time
          this._comm.bus.nodeNum = this._storage.getItem("connection.numNodes") || 0;
          this._comm.run();

          // Auto play 
          if (this._autoPlay) {
            this._programService.playNext();
          }

          // Go to the floor route
          this._router.navigate(['/floor']);
        },
        (err) => {
          alert('Could not connect to the floor: '+ err);
          this._router.navigate(['/floor']);
        });
      }
    });
  }
}
