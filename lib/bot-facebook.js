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

const debug = require('debug')('wchbotserver:bot-facebook');

const path = require('path');
const MongoStorage = require('botkit-storage-mongo');
const Botkit = require('botkit');

const FacebookMessageHandling = require('./skills/facebookMessageHandling');

module.exports = function ({app, wchcore, appSettings}) {
  const env = wchcore.getService('env');
  const {channels: {fb: facebookSettings}, dbService} = appSettings;
  const dbCreds = env.getService('db_config');
  const fbService = env.getService('fb_config');
  const isDbCredsSet = dbCreds && dbCreds.credentials && dbCreds.credentials.mongoUri;

  // Init facebook
  return new Promise((resolve, reject) => {
    if (!facebookSettings.enabled) {
      debug('Facebook channel disabled...');
      return resolve(wchcore);
    }
    if(!fbService) {
      debug('WARN: Facebook credentials are missing...');
      return resolve(wchcore);
    }

    const botOptions = {
      hostname: env.bind,
      port: env.port,
      access_token: fbService.credentials.key,
      verify_token: fbService.credentials.verificationtoken,
      receive_via_postback: true,
      debug: facebookSettings.debug
    };

    if (dbService.enabled && isDbCredsSet) {
      botOptions.storage = MongoStorage({mongoUri: dbCreds.credentials.mongoUri});
    }
    else {
      if (dbService.enabled && !isDbCredsSet) {
        debug('WARN: No db set. Fallback to file storage.');
      }
      botOptions.json_file_store = path.join(__dirname, '.data', 'db'); // eslint-disable-line camelcase
    }

    const controller = Botkit.facebookbot(botOptions);

    FacebookMessageHandling(controller, {wchcore, appSettings});

    let fbBot = controller.spawn({});
    controller.createWebhookEndpoints(app, fbBot, () => {
      debug('Facebook bot is live...');
    });

    return resolve(wchcore);
  });
}
