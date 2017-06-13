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

const debug = require('debug')('wchbotserver:bots');
const appEnv = require('./env');
const botConfig = appEnv.credentials.getService('bot_config');
const middleware = require('./conversation').middleware;
const toneanalyzer = require('./toneanalyzer');
const geolocation = require('./geolocation');
const syncService = require('./sync');

function initBots(app) {
  if (appEnv.settings.bot_config.enabled.slack) {
    var Slack = require('./bot-slack')(middleware);
    // Slack.controller.createWebhookEndpoints(app, [botConfig.credentials.verificationtoken]);
    
    Slack.controller.createWebhookEndpoints(app);
    Slack.controller.createOauthEndpoints(app);
    // Slack.controller.middleware.receive.use(middleware.receive);
    Slack.botContent.startRTM();
    Slack.botWatson.startRTM();
    Slack.bot.startRTM();
    debug('Slack bot is live...');


    debug('Configured /slack/receive url');
    

    // require('./bot-slack-oauth')(app, Slack.controller);

  }

  if (appEnv.settings.bot_config.enabled.raspberry) {
    var Raspberry = require('./bot-raspberry')(middleware);
    // Raspberry.controller.middleware.receive.use(middleware.receive);
    app.use('/rasp', Raspberry.controller.router);
    debug('Raspberry bot is live...');
  }

  // Customize your Watson Middleware object's before and after callbacks.
  middleware.before = function(message, conversationPayload, callback) {
    debug('Before Conversation Middleware %O', conversationPayload);
    debug('Message %O', message);
    
    let _conversationPayload = Object.assign(conversationPayload, {
      clienttype: (message.type==="message.rest") ? "rest" : "slack"
    });

    let tonePromise = new Promise((resolve, reject) => {

      if(toneanalyzer) {
        toneanalyzer.tone(message, (err, tone) => {
          if(err) reject(err);
          resolve(tone);
        });
      } else {
        resolve();
      }

    }).
    catch(err => debug("Toneanalyzer Error: %o", err)).
    then(tone => {
      if(!tone) return;
      let toneObjs = tone.document_tone.tone_categories.reduce((obj, category) => {
          let categoryTonesObj = category.tones.reduce((toneObjs, tone) => {
            toneObjs[tone.tone_name] = tone.score;
            return Object.assign({}, toneObjs);
          }, {});
          return Object.assign({}, obj, {[category.category_name]:categoryTonesObj});
        }, {});
      _conversationPayload.context = Object.assign(
        {}, 
        _conversationPayload.context, 
        {
          tone:toneObjs
        }
      );
    });
    
    let geolocationPromise = (_conversationPayload.context && _conversationPayload.context.setlocation === true) ?
      geolocation.geocode({
        address: message.text
      }).
      asPromise().
      catch(err => debug("Geolocation Error ", err)).
      then(response => {
        debug("Geolocation Response: %o", response.json.results);
        // lat, lng
        _conversationPayload.context = Object.assign({}, _conversationPayload.context, {geolocation: response.json.results[0].geometry.location});
      })
    : Promise.resolve();

    Promise.all([tonePromise, geolocationPromise]).
    catch(err => debug('Error Before: %o', err)).
    then(() => {
      callback(null, _conversationPayload);
    });
  }

  middleware.after = function(message, conversationResponse, callback) {
    debug('After Conversation Middleware...');
    debug('Watson Data: %O', conversationResponse);

    if (appEnv.settings.bot_config.enabled.developermode) {
      debug('Developmode enabled');
      let intent = conversationResponse.intents[0] || {};
      debug('intent %O', intent);
      switch (intent.intent) {
        case 'pushwch':
          debug('pushwch called');
          // Do push...
          syncService.push({
            fromSys: syncService.WCS,
            toSys: syncService.WCH,
            type: 'force',
            elements: 'all',
          }).then(() => callback(null, conversationResponse));
          break;
        default:
          debug('Not a valid command %s', intent.intent);
          callback(null, conversationResponse);
          break;
      }
    } else {
      callback(null, conversationResponse);
    }
  }
}

module.exports = initBots;