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

const debug = require('debug')('wchbotserver:rtm_manager');

module.exports = (controller) => {
  let managedBots = {};

  let manager = {
    start: (bot) => {
      if (managedBots[bot.config.token]) {
        debug('Start RTM: already online');
        return;
      }
      bot.startRTM((err, bot) => {
        if (err) {
          debug('Error starting RTM:', err);
          return;
        }
        managedBots[bot.config.token] = bot.rtm;
        debug('Start RTM: Success');
      });
    },
    stop: (bot) => {
      if (managedBots[bot.config.token] && managedBots[bot.config.token].rtm) {
        debug('Stop RTM: Stopping bot');
        managedBots[bot.config.token].closeRTM()
      }
    },
    remove: (bot) => {
      debug('Removing bot from manager');
      delete managedBots[bot.config.token];
    },
    reconnect: () => {
      debug('Reconnecting all existing bots...');
      controller.storage.teams.all((err, list) => {
        if (err) {
          throw new Error('Error: Could not load existing bots:', err);
        }
        for (let l = 0; l < list.length; l++) {
          debug('Reconnecting %o', Object.assign({id: list[l].id}, list[l].bot));
          manager.start(controller.spawn(Object.assign({id: list[l].id}, list[l].bot)));
        }
      });
    }
  }

  controller.on('error', (err) => {
    debug("err ", err);
  });

  controller.on('spawned', (bot) => {
    debug("spawned bot %o", bot);
  });

  controller.on('create_bot', (bot, team) => {
    debug("created bot %o", bot);
    debug("created team %o", team);
    manager.start(bot);
  });

  // Capture the rtm:start event and actually start the RTM...
  controller.on('rtm_open', (config) => {
    debug('rtm_open %o', config);
  });

  //
  controller.on('rtm_close', (bot) => {
    debug('rtm_close %o', bot);
  });

  return manager;
}