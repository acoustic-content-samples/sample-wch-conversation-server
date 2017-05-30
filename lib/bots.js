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
const botConfig = appEnv.getService('bot_config');
const middleware = require('./conversation').middleware;
const toneanalyzer = require('./toneanalyzer');
const geolocation = require('./geolocation');

function initBots(app) {
  if (botConfig.settings.enabled.slack) {
    var Slack = require('./bot-slack')(middleware);
    // Slack.controller.middleware.receive.use(middleware.receive);
    Slack.bot.startRTM();
    debug('Slack bot is live...');
  }

  if (botConfig.settings.enabled.raspberry) {
    var Raspberry = require('./bot-raspberry')(middleware);
    // Raspberry.controller.middleware.receive.use(middleware.receive);
    app.use('/rasp', Raspberry.controller.router);
    debug('Raspberry bot is live...');
  }

  // Customize your Watson Middleware object's before and after callbacks.
  middleware.before = function(message, conversationPayload, callback) {
    debug('Before Conversation Middleware %O', conversationPayload);
    let _conversationPayload = conversationPayload;
    let tonePromise = new Promise((resolve, reject) => {
      toneanalyzer.tone(message, (err, tone) => {
        if(err) reject(err);
        resolve(tone);
      });
    }).
    catch(err => debug("Toneanalyzer Error: %o", err)).
    then(tone => {
      let toneObjs = tone.document_tone.tone_categories.reduce((obj, category) => {
          let categoryTonesObj = category.tones.reduce((toneObjs, tone) => {
            toneObjs[tone.tone_name] = tone.score;
            return Object.assign({}, toneObjs);
          }, {});
          return Object.assign({}, obj, {[category.category_name]:categoryTonesObj});
        }, {});
      _conversationPayload.context = Object.assign({}, _conversationPayload.context, {clienttype:"slack", tone:toneObjs});
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
    callback(null, conversationResponse);
  }
}

module.exports = initBots;