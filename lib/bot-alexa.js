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

const debug = require('debug')('wchbotserver:bot-alexa');

const appEnv = require('./env');
const alexa_config = appEnv.credentials.getService('alexa_config'); // eslint-disable-line camelcase
const appId = alexa_config.credentials.appid; // eslint-disable-line camelcase

const arrayutils = require('./utils/arrayutils');
const AlexaBot = require('./botkit/Alexa-Bot');
const controller = new AlexaBot({appid: appId, debug: false});
const bot = controller.spawn();
const wchconversation = require('./wchconversation');

const ELE_FALLBACK = 'fallback';

const errHandler = ({err, bot, message, reason}) => {
  debug(err.stack ? err.stack : err);
  bot.reply(message, `This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you. *Reason:* ${reason}`);
};
const transformToAudioMessage = function (resultSet) {
  return new Promise((resolve, reject) => {
    let {watsonData, searchResult, attachmentsResult = {}, followUp = {}, followUpAttachments = {}} = resultSet;
    let followup = (followUp.numFound && followUp.numFound > 0) ? followUp.documents[0].document.elements.text.value : '';
    let attachments = "";

    // Prepare attachments
    if (attachmentsResult.numFound && attachmentsResult.numFound > 0) {
      try {
        attachments = attachmentsResult.documents.reduce((str, attachment) => {
          let elements = attachment.document.elements;
          if (elements[ELE_FALLBACK] && (elements[ELE_FALLBACK].value || elements[ELE_FALLBACK].values)) {
            let fallbackValue = elements[ELE_FALLBACK].value ||  arrayutils.sample(elements[ELE_FALLBACK].values);
            return str.concat(" "+fallbackValue);
          }
          else {
            return str;
          }
        }, "");
      }
      catch (err) {
        debug(err)
        reject(err);
      }
    }

    if (searchResult.numFound > 0) {
      let doc = searchResult.documents[0].document;
      debug('attachments ', attachments);
      resolve({text: `${doc.elements.text.value || arrayutils.sample(doc.elements.text.values)} ${attachments} ${followup}`});
    }
    else {
      resolve({text: "That's a good question. Sadly I don't know the answer yet."});
    }
  });
}

module.exports = function (middleware) {
  controller.hears('.*', ['message_received'], function(bot, message) {
    if (message.match[1] === '') {
      return bot.reply(message, "I can't help you unless you ask me something!");
    }
    middleware.interpret(bot, message, function(err) {
      if (err) {
        debug('Error ', err);
        bot.reply(message, 'This question gave me a headache. Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you.');
      }
      else {
        let { watsonData } = message;
        debug('WatsonData %o', watsonData);
        if (!watsonData || !watsonData.context) {
          errHandler({err: {}, bot, message, reason: 'Cannot reach the conversation service'})
          return;
        }
        watsonData.context.chatbotpersona = 'mrwatson';
        wchconversation.getWchConversationResponses(watsonData)
        .catch(err => debug('error ', err))
        .then(responses => {
          let {locationResp, conversationResp, followupResp = {}} = responses;
          debug('locationResp ', locationResp);
          let respToUse = (locationResp.searchResult.numFound > 0) ? locationResp : conversationResp;
          let {searchResult, attachmentsResult} = respToUse;
          debug('followupResp', followupResp);
          let {searchResult: followUp, attachmentsResult: followUpAttachments } = followupResp;

          return transformToAudioMessage({
            watsonData: watsonData,
            searchResult: searchResult,
            attachmentsResult: attachmentsResult,
            followUp: followUp,
            followUpAttachments: followUpAttachments
          });
        })
        .catch(err => errHandler({err, bot, message}))
        .then(output => new Promise((resolve, reject) => bot.reply(message, output, () => resolve())))
        .catch(err => errHandler({err, bot, message}));
      }
    });
  });

  return { controller, bot };
}
