
import {bootstrap} from '@angular/platform-browser-dynamic'
import {provide, Component} from '@angular/core';
import {disableDeprecatedForms, provideForms} from '@angular/forms';

import {
  LocationStrategy,
  HashLocationStrategy,
  APP_BASE_HREF} from '@angular/common';

var routes = require('./scripts/routes');
var app = require('./scripts/components/app');

//
// Bootstrap
//
bootstrap(app.AppComponent, [
   routes.appRouterProviders,
   disableDeprecatedForms(), provideForms(),
   provide(LocationStrategy, { useClass: HashLocationStrategy }),
   provide(APP_BASE_HREF, { useValue: '/' })
]);