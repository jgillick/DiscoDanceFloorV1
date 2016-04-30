'use strict';

const gulp = require('gulp');
const sass = require('gulp-sass');
const del = require('del');
const exec = require('child_process').exec;
const packager = require('electron-packager')
const webpack = require('webpack');
const webpackConfig = require('./webpack.config.js');
const connect = require('gulp-connect');

const SRC = './src/';
const BUILD = './build/';
const DIST = './dist/';

const STATIC_GLOB = [
  SRC+ '**/*.html',
  SRC+ '**/*.png',
]
const DIST_ICONS = {
  'darwin': './src/images/app_icon.icns',
  'win32': './src/images/app_icon.ico',
}

// Run the program
gulp.task('default', ['build', 'watch'], function(cb){

  // For live asset reloading
  connect.server({
    root: '.',
    livereload: true
  });

  // Launch app
  exec('ENVIRONMENT=DEV ./node_modules/.bin/electron .', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(stderr);
  });
})


// Build the files
gulp.task('build', ['clean', 'static', 'sass', 'js']);

// Update files when then change
gulp.task('watch', function() {
  gulp.watch(STATIC_GLOB, ['static']);
  gulp.watch(SRC +'/styles/**/*.scss', ['sass']);
  gulp.watch(SRC +'/scripts/**/*.js', ['js']);
});

gulp.task('clean', function () {
  return del(BUILD +'/**/*.*');
});

// Copy static files over
gulp.task('static', function(){
  return gulp
    .src(STATIC_GLOB, { base: SRC })
    .pipe(gulp.dest(BUILD))
    .pipe(connect.reload());
})

// Process SCSS files
gulp.task('sass', function(){
  return gulp
    .src(SRC + '/styles/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(BUILD +'/styles'))
    .pipe(connect.reload());
});

// Transpile ES6 files
gulp.task('js', function(cb){
  webpack(webpackConfig).run(cb);
});

// Create an OSX distribution
gulp.task('dist-osx', ['build'], function(cb){
  packager({
    dir: '.',
    out: DIST,
    platform: 'darwin',
    arch: 'x64',
    icon: DIST_ICONS['darwin'],
    ignore: distIgnore,
    'overwrite': true
  }, cb)
});

// Create a Linux distribution
gulp.task('dist-linux', ['build'], function(cb){
  packager({
    dir: '.',
    out: DIST,
    platform: 'linux',
    arch: 'x64',
    ignore: distIgnore,
    'overwrite': true
  }, cb)
});

// Create a Windows distribution
gulp.task('dist-win', ['build'], function(cb){
  packager({
    dir: '.',
    out: DIST,
    platform: 'win32',
    arch: 'x64',
    ignore: distIgnore,
    'overwrite': true
  }, cb)
});


/**
 * Used to determine which files to not package up in the dist
 */
function distIgnore(file) {
  // Font awesome
  if (file.indexOf('node_modules/font-awesome') > -1) {
    return false;
  }
  // Ignore all other modules
  if (file.indexOf('node_modules/') > -1) {
    return true;
  }
  return false;
}
