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

/* jslint node: true, esversion: 6 */
'use strict';

const debug = require('debug')('wchbotserver:app');

const express = require('express');
const bodyParser  = require('body-parser');
const syncRoutes = require('./routes/sync');
const path = require('path');

const appEnv = require('./lib/env');
const bots = require('./lib/bots');

// create a new express server
const app = express();

const logErr = (err) => {debug(err); throw err;}
const logTrace = (value) => {debug(value); return value;}

debug(
`Starting Server...
Environment: ${(appEnv.isLocal) ? "local" : "bluemix"}`
);

app.set('appEnv', appEnv);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

debug('Configured bots');
bots(app);

debug('Configured sync');
app.use('/sync', syncRoutes);

debug('Configured error handling');
/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/** Error Handlers */

let errorHandler;
if (app.get('appEnv').isLocal === true) {
  // Error Handler: Development
  errorHandler = function(err, req, res, next) {
    debug('Error handler %o', err);
    res.status(err.status || 500);
    res.send({
        message: err.message,
        error: err
    });
  };
} else {
  // Error Handler: Production
  errorHandler = function(err, req, res, next) {
    debug('Error handler %o', err);
    res.status(err.status || 500);
    res.send({
        message: err.message,
        error: {}
    });
  };
}

app.use('/', errorHandler);

module.exports = app;