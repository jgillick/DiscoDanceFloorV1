import '../styles/main.scss';

import {bootstrap} from 'angular2/platform/browser'
import {provide, Component} from 'angular2/core';
import {
  APP_BASE_HREF,
  RouteConfig,
  ROUTER_DIRECTIVES,
  ROUTER_PROVIDERS,
  HashLocationStrategy,
  LocationStrategy} from 'angular2/router';

import {DiscoFloor} from './floor.ts';

//
// Root Component
//
@Component({
  selector: 'app-root',
  directives: [ROUTER_DIRECTIVES],
  templateUrl: './html/layout.html'
})
@RouteConfig([
  { path: '/', name: 'DiscoFloor', component: DiscoFloor }
])
export class AppRootComponent {}

//
// Bootstrap
//
bootstrap(AppRootComponent, [
   ROUTER_PROVIDERS,
   provide(LocationStrategy, { useClass: HashLocationStrategy }),
   provide(APP_BASE_HREF, { useValue: '/' })
]);