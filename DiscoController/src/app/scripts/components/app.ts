import {Component} from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router';

import {DiscoFloorComponent} from './floor';
import {SettingsComponent} from './settings';
import {ConnectComponent} from './connect';

import {StorageService} from '../services/storage.service';
import {CommunicationService} from '../services/communication.service';
import {FloorBuilderService} from '../services/floor-builder.service';
import {ProgramControllerService} from '../services/program-controller.service';

//
// Root Component
//
@Component({
  selector: 'app-root',
  templateUrl: './html/layout.html',
  directives: [ROUTER_DIRECTIVES],
  precompile: [
    DiscoFloorComponent,
    SettingsComponent,
    ConnectComponent
  ],
  providers: [
    StorageService,
    FloorBuilderService,
    ProgramControllerService,
    CommunicationService
  ]
})
export class AppComponent {

  constructor(
    private _programService:ProgramControllerService,
    private _storage:StorageService){

    // Start playing automatically
    if (this._storage.getItem('settings.autoPlay') === true) {
      this._programService.playNext();
    }

  }
}