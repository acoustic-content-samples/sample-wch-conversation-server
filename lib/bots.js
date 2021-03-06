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
const express = require('express');

const {promisify} = require('util');
const {join, dirname} = require('path');
const {createApp, resolveConfig, loadConfig} = require('architect');
const createAppAsync = promisify(createApp);
const resolveConfigAsync = promisify(resolveConfig);
const loadConfigAsync = promisify(loadConfig);

const appSettingsName = process.env.APP_SETTINGS || 'app_settings';

const appSettings = require(`../${appSettingsName}`);
const wchCoreConfig = require('wch-conversation-core')(appSettings);
const coreBase = dirname(require.resolve('wch-conversation-core'));
// If you want to create and use custom plugins define them here...
const wchCustomConfig = [];
const customBase = __dirname;

// Channels
let Slack = require('./bot-slack');
let Facebook = require('./bot-facebook');
let Alexa = require('./bot-alexa');
let Raspberry = require('./bot-raspberry');
let Rest = require('./bot-rest');

const initChannels = function ({wchcore, app, appSettings}) {
  debug('Init Channels')
  return Promise.all([
    Slack({wchcore, app, appSettings}),
    Facebook({wchcore, app, appSettings}),
    Raspberry({wchcore, app, appSettings}),
    Alexa({wchcore, app, appSettings}),
    Rest({wchcore, app, appSettings})
  ])
    .then(result => {
      debug('Init Channels done');
      return wchcore;
    });
};

const init = function (app) {
  return Promise.all([
    resolveConfigAsync(wchCoreConfig, coreBase),
    resolveConfigAsync(wchCustomConfig, customBase)
  ])
    .then(([baseConfig, additionalConfig]) => {
      return baseConfig.concat(additionalConfig);
    })
    .then(createAppAsync)
    .then(wchcore => initChannels({wchcore, app, appSettings}))
    .then(wchcore => {
      debug('wchcore %o', wchcore);
      return {
        wchcore: wchcore,
        appEnv: wchcore.getService('env')
      };
    })
    .catch(err => debug(err));
}

module.exports = init;
