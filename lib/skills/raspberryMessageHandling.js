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

const debug = require('debug')('wchbotserver:raspberrymessagehandling');
const arrayutils = require('../utils/arrayutils');

const errHandler = ({err, bot, message, reason}) => {
  debug(err.stack ? err.stack : err);
  bot.reply(message, `This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you. *Reason:* ${reason}`);
};

module.exports = (controller, {wchcore, appSettings}) => {
  const {generalSettings, channels} = appSettings;
  const conversationMiddleware = wchcore.getService('conversationmiddleware');
  const wchconversation =  wchcore.getService('wchconversation');

   controller.hears('.*', ['message_received'], function(bot, message) {
    if (message.match[1] === '') {
      return bot.reply(message, "I can't help you unless you say anything!");
    }

    conversationMiddleware.get().interpret(bot, message, function(err) {
      if (err) {
        debug('Error ', err);
        bot.reply(message, 'This question gave me a headache. Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you.');
      }
      else {
        let { watsonData } = message;
        debug('WatsonData %o', watsonData);
        watsonData.context.chatbotpersona = "mrwatson";
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

}


const ELE_FALLBACK = 'fallback';
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
      resolve({text: `${doc.elements.text.value || arrayutils.sample(doc.elements.text.values)} ${attachments} ${followup}`,
               resultSet: resultSet});
    }
    else if (modeDev) {
      resolve({text: `There is no answer for this question yet! \n *Node:* ${watsonData.output.nodes_visited[watsonData.output.nodes_visited.length-1]} \n *Recognized Entities:* ${JSON.stringify(watsonData.entities.map(ele => ele.value), null, 1)} \n *Nodename:* ${watsonData.context.nodename} \n *OutputLang:* ${watsonData.context.outputlang}`});
    }
    else {
      resolve({text: "That's a good question. Sadly I don't know the answer (yet) :cry:"});
    }
  });
}
