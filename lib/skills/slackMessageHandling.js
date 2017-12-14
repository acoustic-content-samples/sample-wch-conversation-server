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

const debug = require('debug')('wchbotserver:slackmessagehandling');
const arrayutils = require('../utils/arrayutils');

const errHandler = ({err, bot, message, reason}) => {
  debug(`ERROR: ${err.stack ? err.stack : err}`);
  bot.reply(message, `This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you. *Reason:* ${reason}`);
};

module.exports = (controller, {wchcore, appSettings}) => {
  const {generalSettings, channels} = appSettings;
  const conversationMiddleware = wchcore.getService('conversationmiddleware');
  const wchconversation =  wchcore.getService('wchconversation');

  const wchhost = wchcore.getService('wch').hosturl;
  const icons = channels.slack.chatboticons;
  const modeDev = generalSettings.developermode;
  const defaultBotName = channels.slack.chatbotpersona;

  /**
   * This handler is invoked when the technical command '...clear' is typed into the bot. It's a cheap way to
   * clear the current chat view in Slack or Facebook. It's a good pattern for hard-wired commands.
   * Note: This should be removed in production use cases where you don't have to reset your demo.
   */
  controller.hears(['^\\.\\.\\.clear'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
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

  controller.hears(['^(?!\\.\\.\\.).*'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
    if (message.match[1] === '') {
      return bot.reply(message, "This question gave me a headache :face_with_head_bandage: I can't help you unless you type in anything!");
    }
    debug('Incoming message %o', message);

    let { id, name: botname } = bot.identifyBot();
    debug('bot ID %s', id);
    debug('chatbotpersona ', botname);
    debug('BOT %o', bot);
    if (message.user === id) {
      debug('Incoming message originated from bot itself... do nothing');
      return;
    }

    bot.api.users.info({user: message.user, include_locale: true}, function (err, response) {
      if (err) {
        errHandler({err: {}, bot, message, reason: 'Cannot get your locale. Using default.'})
      }
      else {
        let userLocale = response.user.locale.split('-')[0];
        let locale = generalSettings.supportedLanguages.includes(userLocale) ? userLocale : generalSettings.defaultLanguage;
        debug('Slack Locale is: %s', locale);

        conversationMiddleware.get(locale).interpret(bot, message, function (err) {
          if (err) {
            errHandler({err, bot, message, reason: 'Internal Server Error'})
          }
          else {
            let { watsonData, watsonError } = message;
            debug('watsonData %o', watsonData);
            if (watsonError || !watsonData || !watsonData.context) {
              errHandler({err: watsonError, bot, message, reason: 'Cannot reach the conversation service'})
              return;
            }
            if (!message.interactivemessage) {
              watsonData.context.chatbotpersona = botname;
            }

            wchconversation.getWchConversationResponses(watsonData)
              .catch(err => errHandler({err, bot, message, reason: 'WCH could not be reached'}))
              .then(({locationResp, conversationResp, followupResp}) => {
                debug('locationResp %o', locationResp);
                return {respToUse: (locationResp.searchResult.numFound > 0) ? locationResp : conversationResp, followupResp};
              })
              .then(({respToUse, followupResp}) => {
                let {searchResult, attachmentsResult} = respToUse;
                debug('searchresult %o', searchResult);

                return transformToSlackMessage({watsonData: watsonData, searchResult: searchResult, attachmentsResult: attachmentsResult, wchhost, icons, modeDev})
                  .catch(err => errHandler({err, bot, message, reason: 'Transformation to slack message failed'}))
                  .then(output => new Promise((resolve, reject) => bot.reply(message, output, () => resolve(followupResp))))
                  .catch(err => errHandler({err, bot, message, reason: 'Slack could not send the message.'}));
              })
              .then(followupResp => {
                if (!followupResp) {
                  return;
                }
                let {searchResult, attachmentsResult} = followupResp;
                debug('followupResp %o', searchResult);
                transformToSlackMessage({watsonData, searchResult, attachmentsResult, wchhost, icons, modeDev})
                  .catch(err => errHandler({err, bot, message, reason: 'Followup could not be transformed to slack message.'}))
                  .then(output => bot.reply(message, output));
              })
              .catch(err => errHandler({err, bot, message, reason: 'Slack could not send the message.'}));
          }
        });
      }
    });
  });
}

const transformToSlackMessage = function (resultSet) {
  return new Promise((resolve, reject) => {
    let {watsonData, searchResult, attachmentsResult = {}, wchhost, icons, modeDev} = resultSet;
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
                  case 'title_link':
                    value = {'title_link': currEle.linkURL};
                    break;
                  case 'title':
                    value = (currEle.value) ? {'title': currEle.value} : {'title': currEle.linkText, 'title_link': currEle.linkURL};
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

      let output = {
        text: `${doc.elements.text.value || arrayutils.sample(doc.elements.text.values)} ${icon}`,
        attachments: attachments
      };
      let persona = watsonData.context.chatbotpersona || defaultBotName;
      if (persona && persona !== '' && icons[persona] !== null && icons[persona] !== "") {
        output.username = persona;
        output.icon_url = icons[persona]; // eslint-disable-line camelcase
      }
      resolve(output);
    }
    else if (modeDev) {
      resolve({text: `There is no answer for this question yet! \n *Node:* ${watsonData.output.nodes_visited[watsonData.output.nodes_visited.length-1]} \n *Recognized Entities:* ${JSON.stringify(watsonData.entities.map(ele => ele.value), null, 1)} \n *Nodename:* ${watsonData.context.nodename} \n *OutputLang:* ${watsonData.context.outputlang} \n *Action:* ${watsonData.output}`});
    }
    else {
      resolve({text: "That's a good question. Sadly I don't know the answer (yet) :cry:"});
    }
  });
}
