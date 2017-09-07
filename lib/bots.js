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
const syncService = require('./sync');
const toneanalyzer = require('./services/toneanalyzer');
const geolocation = require('./services/geolocation');
const languagetranslator = require('./services/languagetranslator');
const conversation = require('./services/conversation');
const conversationmiddleware = conversation.middleware;

const modeDev = appEnv.settings.bot_config.enabled.developermode;
const supportedLanguages = appEnv.settings.bot_config.supportedLanguages;
const defaultLanguage = appEnv.settings.bot_config.defaultLanguage;

const identifyClientType = function(type) {
  return new Promise((resolve, reject) => {
    try {
      let clienttype;
      switch (type) {
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
      debug('Resolve Clienttype %s', clienttype);
      resolve(clienttype);
    }
    catch (err) {
      reject(err);
    }
  });
}

const identifyLanguage = function (msgText, context) {
  return new Promise((resolve, reject) => {
    if (languagetranslator &&  context && context.setoutputlang) {
      languagetranslator.identify(
        {text: msgText},
        (err, language) => {
          if (err) {
            reject(err);
          }
          else {
            if (language && language.languages && language.languages.length > 0 && supportedLanguages.includes(language.languages[0].language)) {
              debug('Identified language %o', language.languages[0].language);
              resolve(language.languages[0].language);
            } else {
              debug('Language not supported %o. Fallback to default language', language.languages[0].language);
              resolve(defaultLanguage);
            }
          }
        }
      );
    }
    else {
      debug('Language already set to %s', context.outputlang);
      resolve(context.outputlang);
    }
  });
}

const identifyTone = function (message) {
  return new Promise((resolve, reject) => {
    if (toneanalyzer) {
      toneanalyzer.tone(message, (err, tone) => {
        if (err) {
          return reject(err)
        };

        debug('Resolve Toneanalyzer %o', tone);

        let toneObjs = tone.document_tone.tone_categories.reduce((obj, category) => {
          let categoryTonesObj = category.tones.reduce((toneObjs, tone) => {
            toneObjs[tone.tone_name] = tone.score;
            return Object.assign({}, toneObjs);
          }, {});
          return Object.assign({}, obj, {[category.category_name]: categoryTonesObj});
        }, {});
        debug('Transformed Tone %o', toneObjs);

        resolve(toneObjs);
      });
    }
    else {
      debug('Toneanalyzer triggered but not configured.');
      resolve();
    }
  });
}

const identifyGeolocation = function (msgText, context) {
  return new Promise((resolve, reject) => {
    if (geolocation && (context && context.setlocation === true)) {
      debug('Looking for geolocation %s', msgText);
      geolocation.geocode({
        address: msgText
      })
      .asPromise()
      .catch(err => debug('Geolocation Error %s', err))
      .then(response => {
        debug('Geolocation Response: %o', response.json);
        // lat, lng
        if (response.json.results && response.json.results.length > 0) {
          resolve(response.json.results[0].geometry.location);
        }
        else {
          resolve(context.geolocation);
        }
      });
    }
    else {
      debug('Geolocation triggered but not configured.');
      resolve(context.geolocation);
    }
  });
}

 // Customize your Watson Middleware object's before and after callbacks.
conversationmiddleware.before = function(message, conversationPayload, callback) {
  debug('Before Conversation Middleware %s', JSON.stringify(conversationPayload));
  debug('Message %o', message);

  let { text, type } = message;
  let { context } = conversationPayload;

  Promise.all([
    identifyClientType(type),
    identifyLanguage(text, context),
    identifyTone(message),
    identifyGeolocation(text, context)
  ])
  .catch(err => debug('Error Before: %o', err))
  .then(([clientTypeObj, languageObj, toneObj, geolocationObj]) => {
    debug("All Promises resolved!");

    let _conversationPayload = Object.assign({}, conversationPayload);

    _conversationPayload.context = Object.assign(
      {},
      _conversationPayload.context,
      {
        clienttype: clientTypeObj,
        outputlang: languageObj,
        setoutputlang: languageObj ? false : true,
        tone: toneObj,
        geolocation: geolocationObj
      }
    );
    debug('_conversationPayload %o', _conversationPayload);
    callback(null, _conversationPayload);
  })
  .catch(err => debug('An Error occured in conversationmoddleware before. %o', err));
}

conversationmiddleware.after = function(message, conversationResponse, callback) {
  debug('After Conversation Middleware...');
  debug('Watson Data: %o', conversationResponse);

  if (modeDev) {
    debug('Developmode enabled');
    let intent = conversationResponse.intents[0] || {};
    debug('intent %o', intent);
    switch (intent.intent) {
        case 'pushwch':
        case 'pushwch_de':
          debug('pushwch called');
          // Do push...
          syncService.push({
            fromSys: syncService.WCS,
            toSys: syncService.WCH,
            type: 'force',
            elements: 'all',
          })
          .catch(err => debug('An Error Occured %o', err))
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

const initBots = function (app) {
  // Init Slack
  if (appEnv.settings.bot_config.enabled.slack) {
    let Slack = require('./bot-slack')(conversationmiddleware); // eslint-disable-line global-require
    Slack.controller.createHomepageEndpoint(app);
    Slack.controller.createWebhookEndpoints(app);
    Slack.controller.createOauthEndpoints(app);
    if (botConfig && botConfig.credentials && botConfig.credentials.testbot) {
      // Spawn sipmle bot for testing. Note that more advanced use cases like action buttons are only available
      // in a full blown slack app.
      Slack.controller.spawn({
        token: botConfig.credentials.testbot
      }).startRTM();
      debug('Testbot is live...');
    }
    debug('Slack app is live...');
  }
  // Init facebook
  if (appEnv.settings.bot_config.enabled.facebook) {
    let Facebook = require('./bot-facebook')(conversationmiddleware); // eslint-disable-line global-require
    let fbBot = Facebook.controller.spawn({});
    Facebook.controller.createWebhookEndpoints(app, fbBot, () => {
      debug('Facebook bot is live...');
    });
  }
  // Init simple text api for raspberry
  if (appEnv.settings.bot_config.enabled.raspberry) {
    let Raspberry = require('./bot-raspberry')(conversationmiddleware); // eslint-disable-line global-require
    app.use('/rasp', Raspberry.controller.router);
    debug('Raspberry bot is live...');
  }
}

module.exports = initBots;
