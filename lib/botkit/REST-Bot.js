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

/**
 * A simple REST Endpoint that hooks into the Botkit lifecycle.
 *
 * @param {*} configuration
 */
const RESTBot = function (configuration) {
  let restBotkit = Botkit(configuration || {});

  restBotkit.middleware.spawn.use((bot, next) => {
    restBotkit.debug('Spawning...')
    restBotkit.startTicking();

    bot.router = express.Router();

    bot.router.post('/message', (req, resp) => {
      let message = {
        _pipeline: {},
        type: `message.${bot.type}`,
        text: req.body.input,
        user: req.body.user || 'User',
        channel: bot.type || 'rest',
        locale: req.body.locale,
        timestamp: Date.now()
      }
      restBotkit.ingest(bot, message, resp);
    });
    next();
  });

  restBotkit.middleware.ingest.use(function(bot, message, resp, next) {
    message.resp = resp;
    next();
  });


  restBotkit.middleware.categorize.use(function(bot, message, next) {
    if (message.type === 'message.rest') {
      message.type = 'message_received';
    }
    next();
  });

  // simple message clone because its already in the right format!
  restBotkit.middleware.format.use(function(bot, message, platformMessage, next) {
    for (let key in message) {
      platformMessage[key] = message[key];
    }
    if (!platformMessage.type) {
      platformMessage.type = 'message';
    }
    next();
  });

  restBotkit.defineBot(function (botkit, config) {
    let bot = {
      type: config.type,
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
      message.resp.json({text: message.text, resultSet: message.resultSet});
      botkit.debug('Bot Text: ', message.text);
      cb && cb(null, message);
    };

    bot.reply = function (src, resp, cb) {
      botkit.debug('Reply');
      let msg = (typeof resp === 'string') ? {text: resp} : resp;
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
            botkit.tasks[t].convos[c].source_message.user == message.user &&
            botkit.excludedEvents.indexOf(message.type) == -1 // this type of message should not be included
          ) {
            botkit.debug('FOUND EXISTING CONVO!');
            cb(botkit.tasks[t].convos[c]);
            return;
          }
        }
      }
      botkit.debug("No conversation found");
      cb();
    };

    return bot;
  });

  return restBotkit;
};

module.exports = RESTBot;
