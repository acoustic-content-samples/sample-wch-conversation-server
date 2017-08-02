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

const debug = require('debug')('wchbotserver:bots');
const appEnv = require('./env');
const botConfig = appEnv.credentials.getService('bot_config');
const middleware = require('./services/conversation').middleware;
const toneanalyzer = require('./services/toneanalyzer');
const geolocation = require('./services/geolocation');
const syncService = require('./sync');

const modeDev = appEnv.settings.bot_config.enabled.developermode;

const initBots = function (app) {
  if (appEnv.settings.bot_config.enabled.slack) {
    let Slack = require('./bot-slack')(middleware); // eslint-disable-line global-require
    Slack.controller.createHomepageEndpoint(app);
    Slack.controller.createWebhookEndpoints(app);
    Slack.controller.createOauthEndpoints(app);

    if (botConfig && botConfig.credentials && botConfig.credentials.profcontent) {
      Slack.controller.spawn({
        token: botConfig.credentials.profcontent
      }).startRTM();
      debug('Prof Content is live...');
    }
    debug('Slack bot is live...');
  }

  if (appEnv.settings.bot_config.enabled.raspberry) {
    let Raspberry = require('./bot-raspberry')(middleware); // eslint-disable-line global-require
    app.use('/rasp', Raspberry.controller.router);
    debug('Raspberry bot is live...');
  }

  if (appEnv.settings.bot_config.enabled.facebook) {
    let Facebook = require('./bot-facebook')(middleware); // eslint-disable-line global-require
    let fbBot = Facebook.controller.spawn({});
    Facebook.controller.createWebhookEndpoints(app, fbBot, () => {
      debug('Facebook bot is live...');
    });
  }

  // Customize your Watson Middleware object's before and after callbacks.
  middleware.before = function(message, conversationPayload, callback) {
    debug('Before Conversation Middleware %o', conversationPayload);
    debug('Message %o', message);

    let clienttype;
    switch (message.type) {
      case 'message.rest':
        clienttype = 'rest';
        break;
      case 'user_message':
        clienttype = 'fb';
        break;
      default:
        clienttype = 'slack';
        break;
    }

    let _conversationPayload = conversationPayload;
    _conversationPayload.context = Object.assign({}, _conversationPayload.context, {
      clienttype
    });

    let tonePromise = new Promise((resolve, reject) => {
      if (toneanalyzer) {
        toneanalyzer.tone(message, (err, tone) => {
          if (err) {reject(err)};
          resolve(tone);
        });
      }
      else {
        resolve();
      }
    })
    .catch(err => debug("Toneanalyzer Error: %o", err))
    .then(tone => {
      if (!tone) { return callback(null, _conversationPayload)};

      let toneObjs = tone.document_tone.tone_categories.reduce((obj, category) => {
        let categoryTonesObj = category.tones.reduce((toneObjs, tone) => {
          toneObjs[tone.tone_name] = tone.score;
          return Object.assign({}, toneObjs);
        }, {});
        return Object.assign({}, obj, {[category.category_name]: categoryTonesObj});
      }, {});

      _conversationPayload.context = Object.assign(
        {},
        _conversationPayload.context,
        {
          tone: toneObjs
        }
      );
    });

    let geolocationPromise = new Promise((resolve, reject) => {
      if (geolocation && (_conversationPayload.context && _conversationPayload.context.setlocation === true)) {
        geolocation.geocode({
          address: message.text
        })
        .asPromise()
        .catch(err => debug("Geolocation Error ", err))
        .then(response => {
          debug("Geolocation Response: %o", response.json);
          // lat, lng
          if (response.json.results && response.json.results.length > 0) {
            _conversationPayload.context = Object.assign({}, _conversationPayload.context,
            {geolocation: response.json.results[0].geometry.location});
          }
          resolve(_conversationPayload);
        });
      }
      else {
        resolve();
      }
    });

    Promise.all([tonePromise, geolocationPromise])
    .catch(err => debug('Error Before: %o', err))
    .then(() => {
      debug("Conversation Payload Context %o", _conversationPayload.context);
      callback(null, _conversationPayload);
    });
  }

  middleware.after = function(message, conversationResponse, callback) {
    debug('After Conversation Middleware...');
    debug('Watson Data: %o', conversationResponse);

    if (modeDev) {
      debug('Developmode enabled');
      let intent = conversationResponse.intents[0] || {};
      debug('intent %o', intent);
      switch (intent.intent) {
          case 'pushwch':
            debug('pushwch called');
            // Do push...
            syncService.push({
              fromSys: syncService.WCS,
              toSys: syncService.WCH,
              type: 'force',
              elements: 'all',
            })
            .then(() => callback(null, conversationResponse));
            break;
          default:
            debug('Not a valid command %s', intent.intent);
            return callback(null, conversationResponse);
            break;
      }
    }
    else {
      return callback(null, conversationResponse);
    }
  }
}

module.exports = initBots;
