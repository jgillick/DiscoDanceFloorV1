'use strict';

const gulp = require('gulp');
const babel = require('gulp-babel');
const gutil = require('gulp-util');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const exec = require('child_process').exec;
const packager = require('electron-packager')
const shell = require('gulp-shell')

const SRC = './src/';
const BUILD = './build/';
const DIST = './dist/';

const STATIC_GLOB = [
  SRC+ '**/*.html',
  SRC+ '**/*.png',
  SRC+ '**/*.ico',
  SRC+ '**/*.icns',
]
const DIST_ICONS = {
  'darwin': './src/images/app_icon.icns',
  'win32': './src/images/app_icon.ico',
}

// Run the program
gulp.task('default', ['build', 'watch'], shell.task([
  'ENVIRONMENT=DEV ./node_modules/.bin/electron .'
]));

// Build the files
gulp.task('build', ['clean', 'static', 'sass', 'js']);

// Update files when then change
gulp.task('watch', function() {
  gulp.watch(STATIC_GLOB, ['static:watch']);
  gulp.watch(SRC +'/styles/**/*.scss', ['sass:watch']);
  gulp.watch(SRC +'/scripts/**/*.js', ['js:watch']);
});

gulp.task('clean', function (cb) {
  return del(BUILD +'/**/*.*');
});

// Copy static files over
gulp.task('static', ['clean'], staticTask);
gulp.task('static:watch', staticTask);
function staticTask(){
  return gulp
    .src(STATIC_GLOB, { base: SRC })
    .pipe(gulp.dest(BUILD));
}

// Process SCSS files
gulp.task('sass', ['clean'], sassTask);
gulp.task('sass:watch', sassTask);
function sassTask() {
  return gulp
    .src(SRC + '/styles/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(BUILD +'/styles'));
}

// Transpile ES6 files
gulp.task('js', ['clean'], jsTask);
gulp.task('js:watch', jsTask);
function jsTask() {
  return gulp
    .src(SRC + '/scripts/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['es2015'],
      plugins: [
        'angular2-annotations',
        'transform-decorators-legacy'
      ]
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(BUILD +'/scripts'));
}

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
