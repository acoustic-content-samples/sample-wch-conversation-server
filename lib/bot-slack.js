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
const debug = require('debug')('wchbotserver:bot-slack');
const appEnv = require('./env');
const botConfig = appEnv.getService('bot_config');

const Botkit = require('botkit');
const controller = Botkit.slackbot();
const bot = controller.spawn({
  token: botConfig.credentials.slacktoken
});

const wchconversation = require('./wchconversation');

const errHandler = err => {debug(err); bot.reply(message, 'This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you');};

const transformToSlackMessage = function (resultSet) {
  return new Promise((resolve, reject) => {
    let {watsonData, searchResult, attachmentsResult = {}} = resultSet;
    let attachments = [];

    // Prepare attachments
    if(attachmentsResult.numFound && attachmentsResult.numFound > 0) {

      try {
        attachments = attachmentsResult.documents.reduce((arr, attachment) => {
            let slackattachment = Object.keys(attachment.document.elements).
            reduce((attach, key) => {
              let value = undefined;
              let currEle = attachment.document.elements[key];
              switch (key) {
                case 'text':
                case 'color':
                case 'fallback':
                case 'footer':
                case 'pretext':
                  value = {[key] : currEle.value};
                  break;
                case 'title':
                  value = {'title' : currEle.linkText,'title_link':currEle.linkURL};
                  break;
                case 'author':
                  value = {'author_name' : currEle.linkText,'author_link':currEle.linkURL};
                  break;              
                case 'author_icon':
                  if(currEle.renditions)
                    value = {'author_icon' : 'https://my6.digitalexperience.ibm.com'+currEle.renditions.icon.url};
                  break;
                case 'thumb_url':
                  if(currEle.renditions)
                    value = {'thumb_url' : 'https://my6.digitalexperience.ibm.com'+currEle.renditions.thumb.url};
                  break;       
                case 'image_url':
                  if(currEle.renditions)
                    value = {'image_url' : 'https://my6.digitalexperience.ibm.com'+currEle.renditions.default.url};
                  break;
                case 'fields':
                  if(currEle.value)
                    value = {'fields' : JSON.parse(currEle.value)};
                  break;
                default:
                  // statements_def
                  break;
              }
             
              return (value)?Object.assign({}, attach, value):attach;
            }, {});
            debug('slackattachment ', slackattachment);
            return arr.concat([slackattachment]);
        }, []);
      } catch (err) {
        debug(err)
        reject(err);
      }
    }

    if(searchResult.numFound > 0) {
      let doc = searchResult.documents[0].document;
      let icon = '';
      if(doc.elements.emotion.categories) {
        let emotionPath = doc.elements.emotion.categories[0].split('/');
        let emotion = emotionPath[emotionPath.length-1];
        switch (emotion) {
          case 'joy':
            icon = ':wink:';
            break;
        }
      }
      resolve({text: `${doc.elements.text.value} ${icon}`, attachments: attachments});
    } else {
      resolve({text: "That's a good question. Sadly I don't know the answer (yet) :cry:"});
    }
  });
}

module.exports = function(middleware) {

  controller.hears(['^(?!\\.\\.\\.)(.*)'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    debug('Non development attempt! %o', bot.identifyBot())
    bot.startTyping(message);
    bot.reply(message, `:hammer: Sorry I'm currently under development and only online for specific test purposes. Try again later :hammer:`)
  });

  controller.hears(['^(?:\\.\\.\\.)(.*)'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    if(message.match[1] === '') {
        bot.reply(message, "This question gave me a headache :face_with_head_bandage: I can't help you unless you type in anything!");
      return;
    }
    message.text=message.match[1]
    middleware.interpret(bot, message, function(err) {
      bot.startTyping(message);
      if (err) {
        debug('Error ', err);
        bot.reply(message, 'This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you');
      } else {
        let { watsonData } = message;
        let { name } = bot.identifyBot();
        watsonData.context.chatbotpersona = name;

        wchconversation.getWchConversationResponses(watsonData).
        catch(err => debug('error ', err)).
        then(responses => {
          let {locationResp, conversationResp, followupResp} = responses;
          debug('locationResp ', locationResp);
          let respToUse = (locationResp.searchResult.numFound > 0) ? locationResp : conversationResp;
          let {searchResult, attachmentsResult} = respToUse;
          
          transformToSlackMessage({watsonData:watsonData, searchResult: searchResult, attachmentsResult: attachmentsResult}).
          catch(errHandler).
          then(output => new Promise((resolve, reject) => bot.reply(message, output, () => resolve()))).
          catch(errHandler).
          then(() => {
            if(followupResp) {
              debug("followupResp ", followupResp);
              let {searchResult, attachmentsResult} = followupResp;
              transformToSlackMessage({watsonData, searchResult, attachmentsResult}).
              then(output => bot.reply(message, output));
            }
          }).
          catch(errHandler);

        });
      }
    });
  });

  return {
    controller: controller,
    bot: bot
  };
}
