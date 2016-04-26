import '../styles/main.scss';

import {bootstrap} from 'angular2/platform/browser'
import {provide, Component} from 'angular2/core';
import {ROUTER_PROVIDERS} from 'angular2/router';
import {
  LocationStrategy,
  HashLocationStrategy,
  APP_BASE_HREF} from 'angular2/platform/common';

import {AppHomeComponent} from './components/home.ts';


//
// Bootstrap
//
bootstrap(AppHomeComponent, [
   ROUTER_PROVIDERS,
   provide(LocationStrategy, { useClass: HashLocationStrategy }),
   provide(APP_BASE_HREF, { useValue: '/' })
]);