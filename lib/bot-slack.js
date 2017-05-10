const appEnv = require('./env');
const botConfig = appEnv.getService('bot_config');
const Botkit = require('botkit');

const wch = require('./wch').delivery;

const controller = Botkit.slackbot();
const bot = controller.spawn({
  token: botConfig.credentials.slacktoken
});

const processConversationResponse = function (watsonData) {
  return new Promise((resolve, reject) => {
      let { context, output, intents, entities , output:{required = []} } = watsonData;
      let requiredEntities = required.reduce((resarry, reqEntitiy) => {
        return resarry.concat(context[reqEntitiy].map(entity => (`+"${entity.value}"`)));
      }, []);

      let optionalEntities = entities.
        filter(entity => !required.includes(entity.entity)).
        map(entity => `"${entity.value}"^10`);

      let queryEntities = requiredEntities.concat(optionalEntities);
      let queryParams = {
        query:`classification:content ${(queryEntities.length>0) ? 'AND categoryLeaves:('+queryEntities.join(' ')+')':''}`,
        facetquery: [
          `categoryLeaves:${context.chatbotpersona}`, // Persona
          `categoryLeaves:"${output.nodes_visited[output.nodes_visited.length-1]}"`  // Current Conversation Node
        ],
        fields: ['id', 'name', 'document:[json], score']
      };
      console.log('queryParams ', queryParams);
      wch.search.query(queryParams).
      catch(reject).
      then(searchresult => {
        if(searchresult.documents && searchresult.documents[0].document.elements.attachments && searchresult.documents[0].document.elements.attachments.value === true) {
          let filterQuery = searchresult.documents[0].document.elements.attachmentquery.value;
          let attachmentsQuery = {
            query:`classification:content AND type:Attachment AND ${filterQuery}`,
            fields: ['id', 'name', 'document:[json]']
          }
          wch.search.query(attachmentsQuery).
          catch(reject).
          then(attachmentsresult => {
            resolve({watsonData, searchresult, attachmentsresult});
          });
        } else {
          resolve({watsonData, searchresult});
        }
      });
  });
}

const transformToSlackMessage = function (resultSet) {
  return new Promise((resolve, reject) => {
    let {watsonData, searchresult, attachmentsresult = {}} = resultSet;
    let attachments = [];
    // Prepare attachments
    if(attachmentsresult.numFound && attachmentsresult.numFound > 0) {
      attachments = attachmentsresult.documents.reduce((arr, attachment) => {
          let slackattachment = Object.keys(attachment.document.elements).
          reduce((attach, key) => {
            let value = undefined;
            let currEle = attachment.document.elements[key];
            switch (key) {
              case 'text':
              case 'color':
              case 'fallback':
              case 'fields':
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
                value = {'author_icon' : 'https://my6.digitalexperience.ibm.com'+currEle.renditions.icon.url};
                break;
              case 'thumb_url':
                value = {'thumb_url' : 'https://my6.digitalexperience.ibm.com'+currEle.renditions.thumb.url};
                break;
              default:
                // statements_def
                break;
            }
            return (value)?Object.assign({}, attach, value):attach;
            
          }, {});
          return arr.concat([slackattachment]);
      }, []);
    }

    if(searchresult.numFound > 0) {
      let doc = searchresult.documents[0].document;
      let icon = '';
      if(doc.elements.emotion) {
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

  controller.on('im_open', function(bot, message) {
    console.log('open ', message);
    bot.reply(message, 'Hi');
  });

  controller.hears(['^(?!\\.\\.\\.)(.*)'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    console.log('Non development attempt! ', bot.identifyBot())
    bot.startTyping(message);
    bot.reply(message, `:hammer: Sorry I'm currently under development and only online for specific test purposes. Try again later :hammer:`)
  });

  controller.hears(['^(?:\\.\\.\\.)(.*)'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    console.log('Valid development attempt ', message);

    middleware.interpret(bot, message, function(err) {
      if (err) {
        console.log('Error ', err);
        bot.reply(message, 'This question gave me a headache :face_with_head_bandage: Please give me some minutes to recover. But if you are in a hurry I will try again to find an answer for you');
      } 

      bot.startTyping(message);
      // Override the persona in the slack use case...
      let { name } = bot.identifyBot();
      message.watsonData.context.chatbotpersona = name;
      processConversationResponse(message.watsonData).
      catch(err => console.log('error ', err)).
      then(transformToSlackMessage).
      then(output => bot.reply(message, output));
    });

  });

  return {
    controller: controller,
    bot: bot
  };
}
