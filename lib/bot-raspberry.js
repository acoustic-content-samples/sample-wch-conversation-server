const appEnv = require('./env');
const botConfig = appEnv.getService('bot_config');

const wchconversation = require('./wchconversation');
const templating = require('./templating');

const controller = new require('./REST-Bot')({debug: false});
const bot = controller.spawn();
const errHandler = err => {console.log(err); bot.reply(message, 'This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you');};

const transformToAudioMessage = function (resultSet) {
  return new Promise((resolve, reject) => {
    let {watsonData, searchResult, attachmentsResult = {}, followUp = {}, followUpAttachments = {}} = resultSet;
    let followup = (followUp.numFound && followUp.numFound > 0) ? followUp.documents[0].document.elements.text.value : "";
    let attachments = "";

    // Prepare attachments
    if(attachmentsResult.numFound && attachmentsResult.numFound > 0) {
      try {
        attachments = attachmentsResult.documents.reduce((str, attachment) => {
            let slackattachment = attachment.document.elements.fallback.value
              if(attachment.document.elements.fallback && attachment.document.elements.fallback.value) {
                return str.concat(" "+attachment.document.elements.fallback.value);
              } else {
                return str;
              }
        }, "");
      } catch (err) {
        console.log(err)
        reject(err);
      }
    }

    if(searchResult.numFound > 0) {
      let doc = searchResult.documents[0].document;
      console.log('attachments ', attachments);
      resolve({text: `${doc.elements.text.value} ${attachments} ${followup}`});
    } else {
      resolve({text: "That's a good question. Sadly I don't know the answer (yet) :cry:"});
    }
  });
}

module.exports = function(middleware) {

  controller.hears('.*', ['message_received'], function(bot, message) {
    if(message.match[1] === '') {
        bot.reply(message, "I can't help you unless you type in anything!");
      return;
    }
    middleware.interpret(bot, message, function(err) {
      if (err) {
        console.log('Error ', err);
        bot.reply(message, 'This question gave me a headache. Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you.');
      } else {
        let { watsonData } = message;

        wchconversation.getWchConversationResponses(watsonData).
        catch(err => console.log('error ', err)).
        then(responses => {
          let {locationResp, conversationResp, followupResp = {}} = responses;
          console.log('locationResp ', locationResp);
          let respToUse = (locationResp.searchResult.numFound > 0) ? locationResp : conversationResp;
          let {searchResult, attachmentsResult} = respToUse;
          console.log('followupResp' , followupResp);
          let {searchResult: followUp, attachmentsResult : followUpAttachments } = followupResp;
          Promise.all([
            templating.parseJSON(watsonData, searchResult), 
            templating.parseJSON(watsonData, attachmentsResult),
            (followUp) ? templating.parseJSON(watsonData, followUp) : Promise.resolve(),
            (followUpAttachments) ? templating.parseJSON(watsonData, followUpAttachments) : Promise.resolve()
          ]).
          catch(errHandler).
          then(([parsedSearchResult, parsedAttachmentsResult, parsedFollowUp, parsedFollowUpAttachments]) => {
            return transformToAudioMessage({
              watsonData:watsonData, 
              searchResult: parsedSearchResult, 
              attachmentsResult: parsedAttachmentsResult, 
              followUp: parsedFollowUp, 
              followUpAttachments: parsedFollowUpAttachments
            });
          }).
          catch(errHandler).
          then(output => new Promise((resolve, reject) => bot.reply(message, output, () => resolve()))).
          catch(errHandler);
        });
      }
    });
  });

  return { controller, bot };
}
