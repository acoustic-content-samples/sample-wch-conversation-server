const appEnv = require('./env');
const botConfig = appEnv.getService('bot_config');
const Botkit = require('botkit');

const wchconversation = require('./wchconversation');

const controller = Botkit.slackbot();
const bot = controller.spawn({
  token: botConfig.credentials.slacktoken
});

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
            console.log('slackattachment ',slackattachment);
            return arr.concat([slackattachment]);
        }, []);
      } catch (err) {
        console.log(err)
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
    console.log('Non development attempt! ', bot.identifyBot())
    bot.startTyping(message);
    bot.reply(message, `:hammer: Sorry I'm currently under development and only online for specific test purposes. Try again later :hammer:`)
  });

  controller.hears(['^(?:\\.\\.\\.)(.*)'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {

    middleware.interpret(bot, message, function(err) {
      bot.startTyping(message);
      if (err) {
        console.log('Error ', err);
        bot.reply(message, 'This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you');
      } else {
        let { watsonData } = message;
        let { name } = bot.identifyBot();
        watsonData.context.chatbotpersona = name;

        wchconversation.getWchConversationResponses(watsonData).
        catch(err => console.log('error ', err)).
        then(responses => {
          let {conversationResp, followupResp} = responses;
          let {searchResult, attachmentsResult} = conversationResp;
          transformToSlackMessage({watsonData, searchResult, attachmentsResult}).
          then(output => new Promise((resolve, reject) => bot.reply(message, output, () => resolve()))).
          then(() => {
            if(followupResp) {
              console.log("followupResp ", followupResp);
              let {searchResult, attachmentsResult} = followupResp;
              transformToSlackMessage({watsonData, searchResult, attachmentsResult}).
              then(output => bot.reply(message, output));
            }
          });

        });
      }
    });
  });

  return {
    controller: controller,
    bot: bot
  };
}
