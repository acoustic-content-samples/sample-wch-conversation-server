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

const Botkit = require('botkit').core;

const express = require('express');
const router = express.Router();

function RESTBot(configuration) {

    // Create a core botkit bot
    let rest_botkit = Botkit(configuration || {});
    rest_botkit.router = router;

    rest_botkit.middleware.spawn.use(function(bot, next) {
      rest_botkit.debug('Spawning...')
      rest_botkit.startTicking();
      router.post('/message', function(req, resp) {
        let message = {
          type: 'message.rest',
          text: req.body.input,
          user: req.body.user || 'User',
          channel: 'rest',
          timestamp: Date.now(),
          resp: resp
        }
        rest_botkit.receiveMessage(bot, message);
      });

      next();

    });

    rest_botkit.defineBot(function(botkit, config) {

        var bot = {
            botkit: botkit,
            config: config || {},
            utterances: botkit.utterances,
        };

        bot.startConversation = function(message, cb) {
            botkit.startConversation(this, message, cb);
        };

        bot.send = function(message, cb) {
          message.resp.json({text:message.text});
          botkit.debug('Bot Text: ', message.text);
          cb && cb(null, message);
        };

        bot.reply = function(src, resp, cb) {
            botkit.debug('Reply');
            var msg = {};

            if (typeof(resp) == 'string') {
                msg.text = resp;
            } else {
                msg = resp;
            }

            msg.channel = src.channel;
            msg.resp = src.resp;
            bot.say(msg, cb);
        };

        bot.findConversation = function(message, cb) {
            botkit.debug('CUSTOM FIND CONVO', message.user, message.channel);
            for (var t = 0; t < botkit.tasks.length; t++) {
                for (var c = 0; c < botkit.tasks[t].convos.length; c++) {
                    if (
                        botkit.tasks[t].convos[c].isActive() &&
                        botkit.tasks[t].convos[c].source_message.user == message.user
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

    return rest_botkit;
};

module.exports = RESTBot;