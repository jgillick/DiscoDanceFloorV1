import {Component} from '@angular/core';
import {
  RouteConfig,
  ROUTER_DIRECTIVES} from '@angular/router-deprecated';

import {DiscoFloorComponent} from './floor';
import {SettingsComponent} from './settings';
import {ConnectComponent} from './connect';
import {StorageService} from '../services/storage.service';
import {BusProtocolService} from '../services/bus-protocol.service';
import {SerialConnectService} from '../services/serial-connect.service';
import {FloorBuilderService} from '../services/floor-builder.service';
import {ProgramControllerService} from '../services/program-controller.service';

//
// Root Component
//
@Component({
  selector: 'app-root',
  templateUrl: './html/layout.html',
  directives: [ROUTER_DIRECTIVES],
  providers: [
    StorageService,
    FloorBuilderService,
    ProgramControllerService,
    SerialConnectService,
    BusProtocolService
  ]
})
@RouteConfig([
  { path: '/floor', name: 'Floor', component: DiscoFloorComponent, useAsDefault: true },
  { path: '/connect', name: 'Connect', component: ConnectComponent },
  { path: '/settings', name: 'Settings', component: SettingsComponent }
])
export class AppComponent {

  constructor(private floorBuilder:FloorBuilderService){

  }
}