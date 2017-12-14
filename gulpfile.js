/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

//////////////////////////////
// Requires
//////////////////////////////
var gulp = require('gulp'),
    nodemon = require('gulp-nodemon'),
    eslint = require('gulp-eslint'),
    cfenv = require('cfenv'),
    gulpif = require('gulp-if'),
    path = require('path'),
    fs = require('fs');

//////////////////////////////
// Variables
//////////////////////////////
var dirs = {
  'js': {
    'lint': [
      'app.js',
      'lib/**/*.js',
      'src/**/*.js',
      'routes/**/*.js',
      '!src/**/*.min.js'
    ]
  },
  'server': {
    'main': 'bin/www',
    'watch': [
      'app.js',
      'lib',
      'routes'
    ],
    'extension': 'js html hbs',
  }
};

var isCI = (typeof process.env.CI !== 'undefined') ? Boolean(process.env.CI) : false;

//////////////////////////////
// JavaScript Lint Tasks
//////////////////////////////
gulp.task('eslint', function () {
  return gulp.src(dirs.js.lint)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(gulpif(isCI, eslint.failOnError()));
});

gulp.task('eslint:watch', function () {
  return gulp.watch(dirs.js.lint, ['eslint']);
});

//////////////////////////////
// Nodemon Task
//////////////////////////////
gulp.task('nodemon', function (cb) {
  nodemon({
    script: dirs.server.main,
    watch: dirs.server.watch,
    env: {
      'NODE_ENV': 'development'
    },
    ext: dirs.server.extension
  })
  .once('start', function () {
    cb();
  });
});

//////////////////////////////
// Running Tasks
//////////////////////////////

gulp.task('default', ['eslint']);

gulp.task('dev', ['eslint:watch', 'nodemon']);
