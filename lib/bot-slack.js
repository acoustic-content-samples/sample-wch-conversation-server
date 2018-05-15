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

const debug = require('debug')('wchbotserver:bot-slack');
const express = require('express');
const path = require('path');
const MongoStorage = require('botkit-storage-mongo');
const Botkit = require('botkit');

const InteractiveMessages = require('./skills/interactivemessages');
const MessageHandling = require('./skills/slackMessageHandling');
const RTMManager = require('./skills/rtmmanager');

module.exports = function ({app, wchcore, appSettings}){
  debug('Init Slack Channel...');
  const env = wchcore.getService('env');
  const {channels: {slack: slackSettings}, dbService} = appSettings;
  const dbCreds = env.getService('db_config');
  const slackService = env.getService('slack_config');
  const isDbCredsSet = dbCreds && dbCreds.credentials && dbCreds.credentials.mongoUri;

  return new Promise((resolve, reject) => {
    if (!slackSettings.enabled) {
      debug('Slack channel disabled...');
      return resolve(wchcore);
    }
    if (!slackService) {
      debug('WARN: Slack Credentials are missing...');
      return resolve(wchcore);
    }

    const botOptions = {
      hostname: env.bind,
      port: env.port,
      send_via_rtm: false, // eslint-disable-line camelcase
      debug: slackSettings.debug
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

    const controller = Botkit.slackbot(botOptions);
    InteractiveMessages(controller);
    MessageHandling(controller, {wchcore, appSettings});

    if (slackSettings.startApp) {
      const appOptions = {
        hostname: env.bind,
        port: env.port,
        clientId: slackService.credentials.clientid,
        clientSecret: slackService.credentials.clientsecret,
        redirectUri: slackService.credentials.redirectUri,
        scopes: ['bot', 'commands', 'chat:write:bot', 'emoji:read', 'im:read', 'channels:history']
      };
      controller.configureSlackApp(appOptions);

      // Enable verificationtoken. Therefore we need to separate this config from the root of the application.
      // Otherwise all other endpoints would also require the same verificationtoken check...
      let slackRouter = express.Router();
      controller.createHomepageEndpoint(slackRouter);
      controller.createOauthEndpoints(slackRouter);
      controller.createWebhookEndpoints(slackRouter, [slackService.credentials.verificationtoken]);
      app.use('/slackendpoint', slackRouter);
      const rtmManager = RTMManager(controller).reconnect();
      debug('Slack app is live...');
    }

    // Spawn sipmle bot for testing. Note that more advanced use cases like action buttons are only available
    // in a full blown slack app.
    if (slackSettings.startTestBot) {
      controller.spawn({
        token: slackService.credentials.testbot
      }).startRTM();
      debug('Slack Testbot is live...');
    }

    return resolve(wchcore);
  });

  return {
    controller: controller,
  };
}
