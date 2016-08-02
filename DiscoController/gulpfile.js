'use strict';

const gulp = require('gulp');
const babel = require('gulp-babel');
const notify = require("gulp-notify");
const sass = require('gulp-sass');
const shell = require('gulp-shell');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const packager = require('electron-packager');
const path = require('path');

const PACKAGE_JSON = require('./package.json');

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

/**
 * Run the program
 */
gulp.task('default', ['build', 'watch'], shell.task([
  'ENVIRONMENT=DEV ./node_modules/.bin/electron .'
]));

/**
 * Build the files
 */
gulp.task('build', ['clean', 'static', 'sass', 'js', 'typescript']);

/**
 * Update files when then change
 */
gulp.task('watch', function() {
  gulp.watch(STATIC_GLOB, ['static:watch']);
  gulp.watch(SRC +'/app/styles/**/*.scss', ['sass:watch']);
  gulp.watch(SRC +'/**/*.js', ['js:watch']);
  gulp.watch(SRC +'/**/*.ts', ['typescript:watch']);
  gulp.watch('./tsconfig.json', ['typescript:watch']);
});

gulp.task('clean', function (cb) {
  return del(BUILD +'/**/*.*');
});

/**
 * Copy static files over
 */
gulp.task('static', ['clean'], staticTask);
gulp.task('static:watch', staticTask);
function staticTask(){
  return gulp
    .src(STATIC_GLOB, { base: SRC })
    .pipe(gulp.dest(BUILD));
}

/**
 * Process SCSS files
 */
gulp.task('sass', ['clean'], sassTask);
gulp.task('sass:watch', sassTask);
function sassTask() {
  return gulp
    .src(SRC + '/app/styles/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(BUILD +'/app/styles'))
    .on("error", notify.onError({
      title: "Error building CSS",
      message: "<%= error.message %>"
    }));
}

/**
 * Transpile ES6 files
 */
gulp.task('js', ['clean'], jsTask);
gulp.task('js:watch', jsTask);
function jsTask() {
  return gulp
    .src(SRC + '/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['es2015'],
      plugins: []
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(BUILD))
    .on("error", notify.onError({
      title: "Error building JavaScript",
      message: "<%= error.message %>"
    }));
}

/**
 * Compile TypeScript sources
 */
gulp.task('typescript', tsTask);
gulp.task('typescript:watch', tsTask);
function tsTask() {
  return gulp
  .src(path.join(SRC, 'app/scripts/main.ts'), {read: false})
  .pipe(shell(
    [
      './node_modules/.bin/tsc --sourceRoot <%= src %> --outDir <%= out %> --sourceMap'
    ],
    {
      templateData: {
        src: SRC,
        out: path.join(BUILD)
      }
    }
  ))
  .on("error", notify.onError({
    title: "Error building TypeScript"
  }), {emitError: false});
};

/**
 * Create an OSX distribution
 */
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

/**
 * Create a Linux distribution
 */
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

/**
 * Create a Windows distribution
 */
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

  // get module name from path
  var dependencies = Object.keys(PACKAGE_JSON.dependencies),
      moduleMatch = file.match(/node_modules\/?([^\/]*)?\/?.*/),
      moduleName = (!!moduleMatch) ? moduleMatch[1] : null;

  // Non-dev dependencies in package.json should be packaged
  if (moduleName && dependencies.indexOf(moduleName) > -1) {
    return false;
  }
  // Ignore all other modules
  else if (moduleName) {
    return true;
  }
  return false;
}
