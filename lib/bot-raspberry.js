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

const debug = require('debug')('wchbotserver:bot-raspberry');

module.exports = function ({app, wchcore, appSettings}) {
  const env = wchcore.getService('env');
  const {channels: {rasp: raspSettings}, dbService} = appSettings;
  const dbCreds = env.getService('db_config');
  const isDbCredsSet = dbCreds && dbCreds.credentials && dbCreds.credentials.mongoUri;

  // Init Raspberry
  return new Promise((resolve, reject) => {
    if (!raspSettings.enabled) {
      debug('Facebook channel disabled...');
      return resolve(wchcore);
    }

    const RESTBot = require('./botkit/REST-Bot');
    const controller = new RESTBot({debug: false});
    const bot = controller.spawn();

    require('./skills/raspberryMessageHandling')(controller, {wchcore, appSettings});
    // Init simple text api for raspberry
    app.use('/rasp', controller.router);
    debug('Raspberry bot is live...');
    resolve(wchcore)
  });


}
