
import {bootstrap} from '@angular/platform-browser-dynamic'
import {provide, Component, enableProdMode} from '@angular/core';
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
enableProdMode();
bootstrap(app.AppComponent, [
   routes.appRouterProviders,
   disableDeprecatedForms(), provideForms(),
   provide(LocationStrategy, { useClass: HashLocationStrategy }),
   provide(APP_BASE_HREF, { useValue: '/' })
]);