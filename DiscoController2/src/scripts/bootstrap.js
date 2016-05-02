import {bootstrap} from 'angular2/platform/browser'
import {provide, Component} from 'angular2/core';
import {ROUTER_PROVIDERS} from 'angular2/router';
import {
  LocationStrategy,
  HashLocationStrategy,
  APP_BASE_HREF} from 'angular2/platform/common';

import {AppComponent} from './scripts/components/main';

//
// Bootstrap
//
bootstrap(AppComponent, [
   ROUTER_PROVIDERS,
   provide(LocationStrategy, { useClass: HashLocationStrategy }),
   provide(APP_BASE_HREF, { useValue: '/' })
]);