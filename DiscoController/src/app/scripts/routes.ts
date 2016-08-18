import { provideRouter, RouterConfig } from '@angular/router';

import { DiscoFloorComponent } from './components/floor';
import { SettingsComponent } from './components/settings';
import { ConnectComponent } from './components/connect';
import { StartupScreenComponent } from './components/startup-screen';

const routes: RouterConfig = [
  { path: 'startup', component: StartupScreenComponent },
  { path: 'floor', component: DiscoFloorComponent },
  { path: 'connect', component: ConnectComponent },
  { path: 'settings', component: SettingsComponent },

  // Define default route
  { path: '', redirectTo: '/startup', pathMatch: 'full' },
];

export const appRouterProviders = [
  provideRouter(routes)
];