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

const debug = require('debug')('wchbotserver:bot-facebook');
const appEnv = require('./env');
const fbConfig = appEnv.credentials.getService('fb_config');
const dbConfig = appEnv.credentials.getService('db_config');
const wchhost = require('./services/wch').hosturl;

const path = require('path');

const arrayutils = require('./utils/arrayutils');
const MongoStorage = require('botkit-storage-mongo');
const Botkit = require('botkit');

const botOptions = {
  hostname: appEnv.credentials.bind,
  port: appEnv.credentials.port,
  access_token: fbConfig.credentials.key, // eslint-disable-line camelcase
  verify_token: fbConfig.credentials.verificationtoken, // eslint-disable-line camelcase
  receive_via_postback: true, // eslint-disable-line camelcase
  debug: false
};

if (dbConfig && dbConfig.credentials && dbConfig.credentials.mongoUri) {
  const mongoStorage = MongoStorage({mongoUri: dbConfig.credentials.mongoUri});
  botOptions.storage = mongoStorage;
}
else {
  botOptions.json_file_store = path.join(__dirname, '.data', 'db'); // eslint-disable-line camelcase
}

const controller = Botkit.facebookbot(botOptions);

const wchconversation = require('./wchconversation');

const errHandler = ({err, bot, message}) => {debug('%s', err.stack); bot.reply(message, 'This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you');};

const transformToFacebookMessage = function (resultSet) {
  return new Promise((resolve, reject) => {
    let {watsonData, searchResult, attachmentsResult = {}} = resultSet;
    let attachmentElements = [];

    // Prepare attachmentElements
    if (attachmentsResult.numFound && attachmentsResult.numFound > 0) {
      try {
        attachmentElements = attachmentsResult.documents.reduce((arr, attachment) => {
          let attachmentElement = Object.keys(attachment.document.elements)
          .reduce((attach, key) => {
            let value = undefined;
            let currEle = attachment.document.elements[key];
            switch (key) {
                case 'text':
                  if (currEle.value) {
                    value = {'subtitle': currEle.value};
                  }
                  break;
                case 'title':
                  value = Object.assign({
                    'title': currEle.linkText
                  }, (currEle.linkURL) ? {
                    'default_action': {
                      'type': 'web_url',
                      'url': currEle.linkURL,
                      'messenger_extensions': false,
                      'webview_height_ratio': 'tall' // eslint-disable-line camelcase
                    }
                  } : {}
                  );
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
                    value = {'buttons': JSON.parse(currEle.value).map(ele => {
                      return {
                        'type': 'postback',
                        'title': ele.text,
                        'payload': ele.value
                      }
                    })};
                  }
                  break;
                case 'quickreplies':
                  if (currEle.values && currEle.values.length > 0) {
                    value = {
                      'buttons': currEle.values.map(({elements}) => {
                        return {
                          'title': elements.text.value,
                          'type': 'postback',
                          'payload': elements.value.value
                        }
                      })
                    }
                  }
                  break;
                default:
                  // statements_def
                  break;
            }

            return (value)?Object.assign({}, attach, value):attach;
          }, {});
          debug('attachmentElement %o', attachmentElement);
          return arr.concat([attachmentElement]);
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
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic', // eslint-disable-line camelcase
            elements: attachmentElements
          }
        }
      };
      resolve(output);
    }
    else {
      resolve({text: "That's a good question. Sadly I don't know the answer (yet) :cry:"});
    }
  });
}

module.exports = function (middleware) {
  controller.hears(['^\\.\\.\\.clear'], ['message_received'], function(bot, message) {
    debug('Clear View! %o', bot.identifyBot())
    debug('Message is %o', message);
    bot.startTyping(message);
    let clearMsg = '.';
    for (let indx = 0; indx < 100; indx++) {
      clearMsg += '\n';
    }
    clearMsg += '.';
    bot.reply(message, {text: clearMsg});
  });

  // this is triggered when a user clicks the send-to-messenger plugin
  controller.on('facebook_optin', function(bot, message) {
    bot.reply(message, 'Welcome!');
  });

  controller.hears(['^(?!\\.\\.\\.).*'], ['message_received'], function(bot, message) {
    if (message.match[1] === '') {
      return bot.reply(message, "This question gave me a headache :face_with_head_bandage: I can't help you unless you type in anything!");
    }

    debug('BOT %o', bot);

    middleware.interpret(bot, message, function(err) {
      if (err) {
        debug('Error ', err);
        bot.reply(message, 'This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you');
      }
      else {
        let { watsonData } = message;
        debug('watsonData %o', watsonData);

        if (!watsonData || !watsonData.context) {
          debug('No Context! Msg %o', message);
          bot.reply(message, 'This question gave me a headache :face_with_head_bandage: Cannot reach the conversation service...');
          return;
        }

        watsonData.context.chatbotpersona = 'mrwatson';

        wchconversation.getWchConversationResponses(watsonData)
        .catch(err => debug('error ', err))
        .then(responses => {
          let {locationResp, conversationResp, followupResp} = responses;
          debug('locationResp %o', locationResp);
          let respToUse = (locationResp.searchResult.numFound > 0) ? locationResp : conversationResp;
          let {searchResult, attachmentsResult} = respToUse;
          debug('searchresult %o', searchResult);
          transformToFacebookMessage({watsonData: watsonData, searchResult: searchResult, attachmentsResult: attachmentsResult})
          .catch(err => errHandler({err, bot, message}))
          .then(output => new Promise((resolve, reject) => {
            bot.reply(message, {text: output.text}, () => bot.reply(message, {attachment: output.attachment}, () => resolve()));
          }))
          .catch(err => errHandler({err, bot, message}))
          .then(() => {
            if (followupResp) {
              debug('followupResp %o', followupResp);
              let {searchResult, attachmentsResult} = followupResp;
              transformToFacebookMessage({watsonData, searchResult, attachmentsResult})
              .then(output => bot.reply(message, {text: output.text}, () => bot.reply(message, {attachment: output.attachment})));
            }
          })
          .catch(err => errHandler({err, bot, message}));
        });
      }
    });
  });

  return {
    controller: controller,
  };
}
