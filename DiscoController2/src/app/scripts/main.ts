
import {bootstrap} from '@angular/platform-browser-dynamic'
import {provide, Component} from '@angular/core';
import {ROUTER_PROVIDERS} from '@angular/router-deprecated';
import {
  LocationStrategy,
  HashLocationStrategy,
  APP_BASE_HREF} from '@angular/common';

// import {AppComponent} from './components/app';
var app = require('./scripts/components/app');

//
// Bootstrap
//
bootstrap(app.AppComponent, [
   ROUTER_PROVIDERS,
   provide(LocationStrategy, { useClass: HashLocationStrategy }),
   provide(APP_BASE_HREF, { useValue: '/' })
]);