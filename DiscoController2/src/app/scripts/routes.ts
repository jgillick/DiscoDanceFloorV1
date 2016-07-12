import { provideRouter, RouterConfig } from '@angular/router';

import {DiscoFloorComponent} from './components/floor';
import {SettingsComponent} from './components/settings';
import {ConnectComponent} from './components/connect';

const routes: RouterConfig = [
  { path: 'floor', component: DiscoFloorComponent },
  { path: 'connect', component: ConnectComponent },
  { path: 'settings', component: SettingsComponent },

  // Define default route
  { path: '', redirectTo: '/floor', pathMatch: 'full' },
];

export const appRouterProviders = [
  provideRouter(routes)
];