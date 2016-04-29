import {Component} from 'angular2/core';
import {
  RouteConfig,
  ROUTER_DIRECTIVES} from 'angular2/router';

import {DiscoFloorComponent} from './floor';
import {SettingsComponent} from './settings';
import {ConnectComponent} from './connect';

//
// Root Component
//
@Component({
  selector: 'app-root',
  templateUrl: './html/layout.html',
  directives: [ROUTER_DIRECTIVES]
})
@RouteConfig([
  { path: '/floor', name: 'Floor', component: DiscoFloorComponent, useAsDefault: true },
  { path: '/connect', name: 'Connect', component: ConnectComponent },
  { path: '/settings', name: 'Settings', component: SettingsComponent }
])
export class AppHomeComponent {

}