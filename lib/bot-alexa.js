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

/**
 * Alexa module that spawns a new AlexaBot in botkit. It also registers all handlers to create a valid Alexa
 * Response.
 *
 * @module lib/bot-alexa
 */

'use strict';

const debug = require('debug')('wchbotserver:bot-alexa');
const AlexaBot = require('./botkit/Alexa-Bot');
const path = require('path');
const MongoStorage = require('botkit-storage-mongo');

/**
 * Initalization of the alexa controller
 * @param  {Object} middleware - The conversation service middleware
 * @return {Object}            The initalized controller and bot object
 */
module.exports = function ({app, wchcore, appSettings}) {
  const env = wchcore.getService('env');
  const {channels: {alexa: alexaSettings}, dbService} = appSettings;
  const dbCreds = env.getService('db_config');
  const alexaService = env.getService('alexa_config');
  const isDbCredsSet = dbCreds && dbCreds.credentials && dbCreds.credentials.mongoUri;

  // Init facebook
  return new Promise((resolve, reject) => {
    if (alexaSettings.enabled) {
      const botOptions = {appid: alexaService.credentials.appid, debug: alexaSettings.debug};

      if (dbService.enabled && isDbCredsSet) {
        botOptions.storage = MongoStorage({mongoUri: dbCreds.credentials.mongoUri});
      }
      else {
        if (dbService.enabled && !isDbCredsSet) {
          debug('WARN: No db set. Fallback to file storage.');
        }
        botOptions.json_file_store = path.join(__dirname, '.data', 'db'); // eslint-disable-line camelcase
      }

      const controller = new AlexaBot(botOptions);
      require('./skills/alexaMessageHandling')(controller, {wchcore, appSettings});
      const bot = controller.spawn();
      app.use('/alexaendpoint', bot.router);
      debug('Alexa bot is live...');
    }
    return resolve(wchcore);
  });

}
