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
const appEnv = require('./env');
const botConfig = appEnv.credentials.getService('bot_config');
const dbConfig = appEnv.credentials.getService('db_config');
const wchhost = require('./services/wch').hosturl;
const wchconversation = require('./wchconversation');
const arrayutils = require('./utils/arrayutils');

const path = require('path');
const MongoStorage = require('botkit-storage-mongo');
const Botkit = require('botkit');

const { bot_config = {} } = appEnv.settings; // eslint-disable-line camelcase
const modeDev = bot_config.enabled.developermode; // eslint-disable-line camelcase
const slackApp = bot_config.enabled.isslackapp; // eslint-disable-line camelcase
const icons = bot_config.icons; // eslint-disable-line camelcase

const botOptions = {
  hostname: appEnv.credentials.bind,
  port: appEnv.credentials.port,
  send_via_rtm: true, // eslint-disable-line camelcase
  debug: false
};

if (dbConfig && dbConfig.credentials && dbConfig.credentials.mongoUri) {
  botOptions.storage = MongoStorage({mongoUri: dbConfig.credentials.mongoUri});
}
else {
  botOptions.json_file_store = path.join(__dirname, '.data', 'db'); // eslint-disable-line camelcase
}

const controller = Botkit.slackbot(botOptions);

if (slackApp) {
  // Configure Slack App if we have all credentials
  const appOptions = {
    hostname: appEnv.credentials.bind,
    port: appEnv.credentials.port,
    clientId: botConfig.credentials.clientid,
    clientSecret: botConfig.credentials.clientsecret,
    redirectUri: botConfig.credentials.redirectUri,
    scopes: ['bot', 'commands', 'chat:write:bot', 'emoji:read', 'im:read', 'channels:history']
  };
  controller.configureSlackApp(appOptions);
}

require('./skills/interactivemessages')(controller);
const rtmmanager = require('./skills/rtmmanager')(controller).reconnect();

const errHandler = ({err, bot, message, reason}) => {
  debug(err.stack ? err.stack : err);
  bot.reply(message, `This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you. *Reason:* ${reason}`);
};

const transformToSlackMessage = function (resultSet) {
  return new Promise((resolve, reject) => {
    let {watsonData, searchResult, attachmentsResult = {}} = resultSet;
    let attachments = [];

    // Prepare attachments
    if (attachmentsResult.numFound && attachmentsResult.numFound > 0) {
      try {
        attachments = attachmentsResult.documents.reduce((arr, attachment) => {
          let slackattachment = Object.keys(attachment.document.elements)
          .reduce((attach, key) => {
            let value = undefined;
            let currEle = attachment.document.elements[key];
            switch (key) {
                case 'callback_id':
                  value = {[key]: currEle.value, attachment_type: 'default'}; // eslint-disable-line camelcase
                  break;
                case 'text':
                case 'fallback':
                case 'pretext':
                  debug('TextValue %O', currEle);
                  if (currEle.value) {
                    value = {[key]: currEle.value};
                  }
                  if (currEle.values) {
                    value = {[key]: arrayutils.sample(currEle.values)};
                  }
                  break;
                case 'color':
                case 'footer':
                  value = {[key]: currEle.value};
                  break;
                case 'title':
                  value = {'title': currEle.linkText, 'title_link': currEle.linkURL};
                  break;
                case 'author':
                  value = {'author_name': currEle.linkText, 'author_link': currEle.linkURL};
                  break;
                case 'author_icon':
                  if (currEle.renditions) {
                    value = {'author_icon': wchhost+currEle.renditions.icon.url};
                  }
                  break;
                case 'thumb_url':
                  if (currEle.renditions) {
                    value = {'thumb_url': wchhost+currEle.renditions.thumb.url};
                  }
                  break;
                case 'image_url':
                  if (currEle.renditions) {
                    value = {'image_url': wchhost+currEle.renditions.default.url};
                  }
                  break;
                case 'fields':
                  if (currEle.value) {
                    value = {'fields': JSON.parse(currEle.value)};
                  }
                  break;
                case 'action':
                  if (currEle.value) {
                    value = {'actions': JSON.parse(currEle.value)};
                  }
                  break;
                case 'quickreplies':
                  if (currEle.values && currEle.values.length > 0) {
                    value = {
                      'actions': currEle.values.map(({elements}) => {
                        debug('Action Elements %o', elements);
                        let style;
                        if (elements.primarybutton.value === true) {
                          style = 'primary';
                        }
                        else if (elements.dangerbutton.value === true) {
                          style = 'danger';
                        }
                        else {
                          style = 'default';
                        }
                        return {
                          'name': elements.name.value,
                          'text': elements.text.value,
                          'type': 'button',
                          'value': elements.value.value,
                          'style': style
                        }
                      })
                    }
                  }
                  break;
                default:
                  break;
            }

            return (value) ? Object.assign({}, attach, value) : attach;
          }, {});
          debug('slackattachment %o', slackattachment);
          return arr.concat([slackattachment]);
        }, []);
      }
      catch (err) {
        debug(err)
        reject(err);
      }
    }

    if (searchResult.numFound > 0) {
      let doc = searchResult.documents[0].document;
      let icon = '';
      if (doc.elements.emotion.categories) {
        let emotionPath = doc.elements.emotion.categories[0].split('/');
        let emotion = emotionPath[emotionPath.length-1];
        switch (emotion) {
            case 'joy':
              icon = ':wink:';
              break;
        }
      }

      let output = {
        text: `${doc.elements.text.value || arrayutils.sample(doc.elements.text.values)} ${icon}`,
        attachments: attachments
      };
      let persona = watsonData.context.chatbotpersona || 'mrwatson';
      if (persona && persona !== '' && icons[persona] !== null && icons[persona] !== "") {
        output.username = persona;
        output.icon_url = icons[persona]; // eslint-disable-line camelcase
      }
      resolve(output);
    }
    else if (modeDev) {
      resolve({text: `There is no answer for this question yet! \n *Node:* ${watsonData.output.nodes_visited[watsonData.output.nodes_visited.length-1]} \n *Recognized Entities:* ${JSON.stringify(watsonData.entities.map(ele => ele.value), null, 1)} \n *Nodename:* ${watsonData.context.nodename} \n *OutputLang:* ${watsonData.context.outputlang}`});
    }
    else {
      resolve({text: "That's a good question. Sadly I don't know the answer (yet) :cry:"});
    }
  });
}

module.exports = function (middleware){
  /**
   * This handler is invoked when the technical command '...clear' is typed into the bot. It's a cheap way to
   * clear the current chat view in Slack or Facebook. It's a good pattern for hard-wired commands.
   * Note: This should be removed in production use cases where you don't have to reset your demo.
   */
  controller.hears(['^\\.\\.\\.clear'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    debug('Clear View! %o', bot.identifyBot())
    debug('Message is %o', message);
    bot.startTyping(message);
    let clearMsg = '.';
    for (let indx = 0; indx < 300; indx++) {
      clearMsg += '\n';
    }
    clearMsg += '.';
    bot.reply(message, {text: clearMsg});
  });

  controller.hears(['^(?!\\.\\.\\.).*'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    if (message.match[1] === '') {
      return bot.reply(message, "This question gave me a headache :face_with_head_bandage: I can't help you unless you type in anything!");
    }
    debug('Incomming message %o', message);

    middleware.interpret(bot, message, function (err) {
      let { id, name } = bot.identifyBot();
      debug('bot ID %s', id);
      debug('chatbotpersona ', name);
      debug('BOT %o', bot);
      if (message.user === id) {
        debug('Incomming message orinated from bot itself... do nothing');
        return;
      }

      if (err) {
        errHandler({err, bot, message, reason: 'Internal Server Error'})
      }
      else {
        let { watsonData } = message;
        debug('watsonData %o', watsonData);

        if (!watsonData || !watsonData.context) {
          errHandler({err: {}, bot, message, reason: 'Cannot reach the conversation service'})
          return;
        }

        watsonData.context.chatbotpersona = name;

        wchconversation.getWchConversationResponses(watsonData)
        .catch(err => errHandler({err, bot, message, reason: 'WCH could not be reached'}))
        .then(responses => {
          let {locationResp, conversationResp, followupResp} = responses;
          debug('locationResp %o', locationResp);
          let respToUse = (locationResp.searchResult.numFound > 0) ? locationResp : conversationResp;
          let {searchResult, attachmentsResult} = respToUse;
          debug('searchresult %o', searchResult);
          transformToSlackMessage({watsonData: watsonData, searchResult: searchResult, attachmentsResult: attachmentsResult})
          .catch(err => errHandler({err, bot, message, reason: 'Transformation to slack message failed'}))
          .then(output => new Promise((resolve, reject) => bot.reply(message, output, () => resolve())))
          .catch(err => errHandler({err, bot, message, reason: 'Slack could not send the message.'}))
          .then(() => {
            if (followupResp) {
              debug('followupResp %o', followupResp);
              let {searchResult, attachmentsResult} = followupResp;
              transformToSlackMessage({watsonData, searchResult, attachmentsResult})
              .catch(err => errHandler({err, bot, message, reason: 'Followup could not be transformed to slack message.'}))
              .then(output => bot.reply(message, output));
            }
          })
          .catch(err => errHandler({err, bot, message, reason: 'Slack could not send the message.'}));
        });
      }
    });
  });

  return {
    controller: controller,
  };
}
