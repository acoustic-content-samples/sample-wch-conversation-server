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

const debug = require('debug')('wchbotserver:bot-rest');
const path = require('path');
const RESTBot = require('./botkit/REST-Bot');
const MongoStorage = require('botkit-storage-mongo');

module.exports = function ({app, wchcore, appSettings}) {
  const env = wchcore.getService('env');
  const {channels: {rest: restSettings}, dbService} = appSettings;
  const dbCreds = env.getService('db_config');
  const isDbCredsSet = dbCreds && dbCreds.credentials && dbCreds.credentials.mongoUri;


  // Init Rest Api
  return new Promise((resolve, reject) => {
    if (!restSettings.enabled) {
      debug('REST channel disabled...');
      return resolve(wchcore);
    }

    let botOptions = {
      dadsadsa: 'DSADSADSA',
      debug: restSettings.debug
    }

    if (dbService.enabled && isDbCredsSet) {
      botOptions.storage = MongoStorage({mongoUri: dbCreds.credentials.mongoUri});
    }
    else {
      if (dbService.enabled && !isDbCredsSet) {
        debug('WARN: No db set. Fallback to file storage.');
      }
      botOptions.json_file_store = path.join(__dirname, '.data', 'db'); // eslint-disable-line camelcase
    }

    const controller = new RESTBot(botOptions);
    require('./skills/restMessageHandling')(controller, {wchcore, appSettings});
    const bot = controller.spawn({type: 'rest'});
    // Init simple text api for raspberry
    app.use('/rest', bot.router);
    debug('REST bot is live...');
    resolve(wchcore)
  });


}
