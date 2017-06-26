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
    sourcemaps = require('gulp-sourcemaps'),
    eslint = require('gulp-eslint'),
    uglify = require('gulp-uglify'),
    sass = require('gulp-sass'),
    importOnce = require('node-sass-import-once'),
    autoprefixer = require('gulp-autoprefixer'),
    sasslint = require('gulp-sass-lint'),
    imagemin = require('gulp-imagemin'),
    cfenv = require('cfenv'),
    gulpif = require('gulp-if'),
    browserSync = require('browser-sync'),
    fileinclude = require('gulp-file-include'),
    svgmin = require('gulp-svgmin'),
    svgstore = require('gulp-svgstore'),
    path = require('path'),
    rename = require('gulp-rename'),
    glob = require('glob'),
    es = require('event-stream'),
    async = require('async'),
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
    ],
    'uglify': [
      'src/js/**/*.js',
      '!src/js/**/*.min.js'
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
  },
  'sass': 'src/sass/**/*.scss',
  'images': 'src/images/**/*.*',
  'svg': ['src/svg/**/*.svg'],
  'svgOut': 'public/svg/',
  'public': 'public/'
};

var isCI = (typeof process.env.CI !== 'undefined') ? Boolean(process.env.CI) : false;

//////////////////////////////
// Update BrowserSync
//////////////////////////////
browserSync = browserSync.create();

//////////////////////////////
// JavaScript Lint Tasks
//////////////////////////////
gulp.task('eslint', function () {
  return gulp.src(dirs.js.lint)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(gulpif(isCI, eslint.failOnError()));
});

gulp.task('uglify', function () {
  return gulp.src(dirs.js.uglify)
    .pipe(gulpif(!isCI, sourcemaps.init()))
      .pipe(uglify({
        'mangle': isCI ? true : false
      }))
    .pipe(gulpif(!isCI, sourcemaps.write('maps')))
    .pipe(gulp.dest(dirs.public + 'js'))
    .pipe(browserSync.stream());
});

gulp.task('eslint:watch', function () {
  return gulp.watch(dirs.js.lint, ['eslint']);
});

gulp.task('uglify:watch', function () {
  return gulp.watch(dirs.js.uglify, ['uglify']);
});

//////////////////////////////
// Sass Tasks
//////////////////////////////
gulp.task('sass', function () {
  return gulp.src(dirs.sass)
    .pipe(sasslint())
    .pipe(sasslint.format())
    .pipe(gulpif(isCI, sasslint.failOnError()))
    .pipe(gulpif(!isCI, sourcemaps.init()))
      .pipe(sass({
        'outputStyle': isCI ? 'expanded' : 'compressed',
        'importer': importOnce,
        'importOnce': {
          'index': true,
          'css': true,
          'bower': true
        }
      }))
      .pipe(autoprefixer())
    .pipe(gulpif(!isCI, sourcemaps.write('maps')))
    .pipe(gulp.dest(dirs.public + 'css'))
    .pipe(browserSync.stream());
});

gulp.task('sass:watch', function () {
  return gulp.watch(dirs.sass, ['sass']);
});

//////////////////////////////
// Image Tasks
//////////////////////////////
gulp.task('images', function () {
  return gulp.src(dirs.images)
    .pipe(imagemin({
      'progressive': true,
      'svgoPlugins': [
        { 'removeViewBox': false }
      ]
    }))
    .pipe(gulp.dest(dirs.public + '/images'));
});

gulp.task('images:watch', function () {
  return gulp.watch(dirs.images, ['images']);
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
  })
  .on('restart', function () {
    setTimeout(function () {
      browserSync.reload();
    }, 500);
  });
});

//////////////////////////////
// Browser Sync Task
//////////////////////////////
gulp.task('browser-sync', ['nodemon'], function () {
  var appEnv = cfenv.getAppEnv();

  browserSync.init({
    'proxy': appEnv.url
  });
});

//////////////////////////////
// Libs Task
//////////////////////////////
gulp.task('libs', function () {
  return gulp.src('bower_components/socket.io-client/socket.io.js')
  .pipe(gulp.dest(dirs.public + '/js'));
});

//////////////////////////////
// Fileinclud Task
//////////////////////////////
gulp.task('fileinclude', function () {
  gulp.src('views/index.html')
    .pipe(fileinclude({
      prefix: '@@',
      basepath: '@file'
    }))
    .pipe(gulp.dest(dirs.public));
});



//////////////////////////////
// SVG Task
//////////////////////////////
gulp.task("minimizeSvgs", function () {
    var icons = '',
        svgOpts = function (file) {
            var prefix = path.basename(file.relative,
                    path.extname(file.relative));

            return {
                plugins: [
                    {
                        cleanupIDs: {
                            prefix: prefix + "-"
                        }
                    }
                ]
            };
        };

    icons = gulp.src(dirs.svg,
        {"base": "src/svg/"})
        .pipe(svgmin(svgOpts))
        .pipe(gulp.dest(dirs.svgOut));

    return icons;
});

gulp.task("buildSvgSprite", ["minimizeSvgs"], function (done) {
    var spriteGeneration,
        sprites = [
            {
                paths: [dirs.svgOut + "/**/*.svg"],
                options: { inlineSvg: true },
                name: "iconsblog.svg"
            }
        ];

    spriteGeneration = es.concat(sprites.map(sprite => {
        return gulp.src(sprite.paths)
            .pipe(svgstore(sprite.options))
            .pipe(rename(sprite.name))
            .pipe(gulp.dest(dirs.svgOut));
    }));

    // output a json object with all of the icons in sprites here.
    function spriteData (callback) {
        async.waterfall(
            [
                next => {
                    async.map(sprites,
                        (sprite, cb) => {
                            var pattern = sprite.paths.length > 1 ?
                                `{${sprite.paths.join(",")}}` :
                                sprite.paths[0];

                            glob(pattern, (err, files) => {
                                files = files || [];

                                cb(err, files.map(file => {
                                    return {
                                        id: path.basename(file, ".svg"),
                                        options: sprite.options,
                                        sprite: sprite.name
                                    };
                                }));
                            });
                        },
                        next
                    );
                },
                (files, next) => {
                    // flatten
                    files = files.reduce((a, b) => a.concat(b), []);

                    fs.writeFile(
                        path.resolve(dirs.svgOut, "spriteIcons.json"),
                        JSON.stringify(files),
                        "utf8",
                        next
                    );
                }
            ],
            callback
        );
    }

    spriteGeneration.on("end", () => spriteData(done));
});

//////////////////////////////
// Running Tasks
//////////////////////////////
gulp.task('build', ['libs', 'fileinclude', 'uglify', 'sass', 'images']);

gulp.task('test', ['build']);

gulp.task('watch', ['eslint:watch', 'uglify:watch', 'sass:watch', 'images:watch']);

gulp.task('default', ['browser-sync', 'build', 'watch']);

gulp.task("svg", ["minimizeSvgs", "buildSvgSprite"]); 

gulp.task("dev", ['eslint:watch', 'nodemon']);
