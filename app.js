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

const debug = require('debug')('wchbotserver:app');

const express = require('express');
const bodyParser  = require('body-parser');
// const syncRoutes = require('./routes/sync');
const path = require('path');

const bots = require('./lib/bots');

// create a new express server
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

debug('Configuring bots...');
let initPromise = bots(app)
  .then(config => {
    debug('Configuring bots finished');
    app.set('appEnv', config.appEnv);

    debug(
      `Starting Server...
      Environment: ${(app.get('appEnv').isLocal) ? "local" : "bluemix"}`
    );

    debug('Configuring sync...');
    // app.use('/sync', syncRoutes);
    debug('Configuring sync finished');

    debug('Configuring error handling...');
    /* Catch 404 and forward to error handler */
    app.use(function(req, res, next) {
      let err = new Error('Not Found');
      err.status = 404;
      next(err);
    });

    /* Error Handlers */

    // Log unhandled Promise expections
    process.on('unhandledRejection', (reason, p) => {
      debug('Unhandled Rejection at: %o reason: %s', p, reason);
    });

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
    }
    else {
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
    debug('Configuring error handling finished');

  })
  .catch(err => debug(err));

module.exports = initPromise.then(() => app);
