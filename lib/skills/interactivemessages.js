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

const debug = require('debug')('wchbotserver:interactivemessages');

module.exports = (controller) => {
  debug('Configured interactive_message_callback');
  controller.on('interactive_message_callback', function(bot, trigger) {
    debug('Trigger interactive_message_callback %o', trigger);

    let message = {
      user: trigger.user,
      channel: trigger.channel,
      team: trigger.team.id,
      text: `${trigger.actions[0].value}`,
      type: 'message',
      interactivemessage: true
    };

    controller.receiveMessage(bot, message);

    return false; // do not bubble event
  });
}
