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

const Botkit = require('botkit').core;
const express = require('express');
const errUtils = require('../utils/errorutils');

/**
 * A simple Alexa Bot for Botkit.
 *
 * @param {*} configuration
 */
const AlexaBot = function (configuration) {
  if (!configuration.appid) {
    errUtils.requiredParam('appid');
  }
  let alexaBotkit = Botkit(configuration || {});

  alexaBotkit.middleware.spawn.use((bot, next) => {
    alexaBotkit.debug('Spawning...')
    alexaBotkit.startTicking();

    bot.router = express.Router();

    bot.router.use(function (req, res, next) {
      let {body = {}} = req;
      let {session} = body;
      if (session.application.applicationId === alexaBotkit.config.appid) {
        return next()
      }
      alexaBotkit.debug("App Id dont match...");
      res.status(401).send('Wrong App ID').end();
    });

    bot.router.post('/message', (req, resp) => {
      console.log('Alexa Incomming Request: ', JSON.stringify(req.body));
      let {body = {}} = req;
      let {session, request = {}, context} = body;
      switch (request.type) {
          case 'LaunchRequest':
            alexaBotkit.debug('LaunchRequest received...');
            let launchmessage = {
              _pipeline: {},
              type: 'message.alexaintent',
              text: 'Hi',
              user: session.user.hasOwnProperty('userId') ?  session.user.userId : 'anonymous_alexa_user',
              channel: 'alexa',
              timestamp: Date.parse(request.timestamp),
              locale: request.locale,
              resp: resp
            }
            alexaBotkit.categorize(bot, launchmessage);
            break;
          case 'IntentRequest':
            alexaBotkit.debug('IntentRequest received...');
            let intentmessage = {
              _pipeline: {},
              type: 'message.alexaintent',
              text: request.intent.slots.search.value,
              user: session.user.userId || 'anonymous_alexa_user',
              channel: 'alexa',
              timestamp: Date.parse(request.timestamp),
              locale: request.locale,
              resp: resp
            }
            alexaBotkit.categorize(bot, intentmessage);
            break;
          case 'SessionEndedRequest':
            alexaBotkit.debug('SessionEndedRequest received...');
            let sessionEnd = {
              _pipeline: {},
              type: 'message.alexaintent',
              text: 'Goodbye',
              user: session.user.userId || 'anonymous_alexa_user',
              channel: 'alexa',
              timestamp: Date.parse(request.timestamp),
              locale: request.locale,
              resp: resp
            }
            alexaBotkit.categorize(bot, sessionEnd);
            break;
          default:
            alexaBotkit.debug('Unsupported type received:', request.type);
      }
    });
    next();
  });

  alexaBotkit.middleware.categorize.use(function(bot, message, next) {
    if (message.type === 'message.alexaintent') {
      message.type = 'message_received';
    }
    next();
  });

  // simple message clone because its already in the right format!
  alexaBotkit.middleware.format.use(function(bot, message, platformMessage, next) {
    for (let key in message) {
      platformMessage[key] = message[key];
    }
    if (!platformMessage.type) {
      platformMessage.type = 'message';
    }
    next();
  });

  alexaBotkit.defineBot(function (botkit, config) {
    let bot = {
      botkit: botkit,
      config: config || {},
      utterances: botkit.utterances,
    };

    bot.startConversation = function (message, cb) {
      botkit.debug('startConversation');
      botkit.startConversation(this, message, cb);
    };

    bot.createConversation = function(message, cb) {
      botkit.debug('createConversation');
      botkit.createConversation(this, message, cb);
    };

    bot.send = function (message, cb) {
      message.resp
        .json({
          "version": "1.0",
          "response": {
            "shouldEndSession": false,
            "outputSpeech": {
              "type": "PlainText",
              "text": message.text
            }
          }
        });
      botkit.debug('Bot Text: ', message.text);
      cb && cb(null, message);
    };

    bot.reply = function (src, resp, cb) {
      botkit.debug('Reply');
      let msg = {};

      if (typeof resp === 'string') {
        msg.text = resp;
      }
      else {
        msg = resp;
      }

      msg.channel = src.channel;
      msg.resp = src.resp;
      bot.say(msg, cb);
    };

    bot.findConversation = function (message, cb) {
      botkit.debug('Custom Find Conversation ', message.user, message.channel);
      for (let t = 0; t < botkit.tasks.length; t++) {
        for (let c = 0; c < botkit.tasks[t].convos.length; c++) {
          if (
            botkit.tasks[t].convos[c].isActive() &&
            botkit.tasks[t].convos[c].source_message.user === message.user
          ) {
            botkit.debug('Found existing conversation!');
            cb(botkit.tasks[t].convos[c]);
            return;
          }
        }
      }

      cb();
    };
    botkit.debug('Found no existinting conversation!');
    return bot;
  });

  return alexaBotkit;
};

module.exports = AlexaBot;
