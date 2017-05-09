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
      console.log('required ', required)

      let requiredEntitties = required.reduce((resarry, reqEntitiy) => {
        return resarry.concat(context[reqEntitiy].map(entity => (`categoryLeaves:"${entity.value}"`)));
      }, []);

      let queryParams = {
        query:'classification:content',
        facetquery: [
          `categoryLeaves:${context.chatbotpersona}`, // Persona
          `categoryLeaves:"${output.nodes_visited[output.nodes_visited.length-1]}"`,  // Current Conversation Node
          requiredEntitties.join(' AND '), // Required Entities
          entities.map(entity => (`categoryLeaves:"${entity.value}"`)).join(' OR ')], // Optional Entities
        fields: ['id', 'name', 'document:[json], score']
      };
      console.log('queryParams ', queryParams);
      wch.search.query(queryParams).
      then(searchresult => {
        console.log(searchresult)
        resolve({watsonData, searchresult});
      });
  });
}

const transformToSlackMessage = function (resultSet) {
  return new Promise((resolve, reject) => {
    if(resultSet.searchresult.numFound > 0)
      resolve(resultSet.searchresult.documents[0].document.elements.text.value);
    else 
      resolve("Apparently I don't have any information on this topic.");
  });
}

module.exports = function(middleware) {

  controller.hears(['^(?!\\.\\.\\.)(.*)'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    console.log('Non development attempt! ', bot.identifyBot())
    bot.reply(message, `Sorry I'm currently under development and only online for specific test purposes. Try again later.`)

  });

  controller.hears(['^(?:\\.\\.\\.)(.*)'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    console.log('Valid development attempt ', message);

    middleware.interpret(bot, message, function(err) {
      if (err) console.log('Error ', err);

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
