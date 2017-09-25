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
const router = express.Router();

const AlexaBot = function (configuration) {
  let alexaBotkit = Botkit(configuration || {});
  alexaBotkit.router = router;

  alexaBotkit.middleware.spawn.use((bot, next) => {
    alexaBotkit.debug('Spawning...')
    alexaBotkit.startTicking();
    router.post('/message', (req, resp) => {
      console.log('Alexa Incomming Request: ', JSON.stringify(req.body));
      let {body = {}} = req;
      let {session, request = {}, context} = body;

      if(request.type === 'LaunchRequest') {
        let message = {
          type: 'message.alexaintent',
          text: 'Hallo',
          user: session.user.userId || 'anonymous_alexa_user',
          channel: 'alexa',
          timestamp: Date.parse(request.timestamp),
          locale: request.locale,
          resp: resp
        }
        alexaBotkit.receiveMessage(bot, message);
      }

      if(request.type === 'IntentRequest') {
        let message = {
          type: 'message.alexaintent',
          text: request.intent.slots.search.value,
          user: session.user.userId || 'anonymous_alexa_user',
          channel: 'alexa',
          timestamp: Date.parse(request.timestamp),
          locale: request.locale,
          resp: resp
        }
        alexaBotkit.receiveMessage(bot, message);
      }
      // resp.json({
      //       "version": "1.0",
      //       "sessionAttribute": {},
      //       "response": {
      //           "outputSpeech": {
      //               "type": 'PlainText',
      //               "text": 'Hallo Welt!',
      //           },
      //           "card": {
      //               "type": "Simple",
      //               "title": `SessionSpeechlet - Hallo`,
      //               "content": `SessionSpeechlet - Welt`,
      //           },
      //           "reprompt": {
      //               "outputSpeech": {
      //                   "type": 'PlainText',
      //                   "text": 'reprompt Welt!',
      //               },
      //           },
      //           "shouldEndSession": true
      //       }
      //   });
    });
    next();
  });

  alexaBotkit.defineBot(function (botkit, config) {
    let bot = {
      botkit: botkit,
      config: config || {},
      utterances: botkit.utterances,
    };

    bot.startConversation = function (message, cb) {
      botkit.startConversation(this, message, cb);
    };

    bot.send = function (message, cb) {
      message.resp
      .json({
        "version": "1.0",
        "response": {
          "shouldEndSession": true,
          "outputSpeech":{
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

    return bot;
  });

  return alexaBotkit;
};

module.exports = AlexaBot;
