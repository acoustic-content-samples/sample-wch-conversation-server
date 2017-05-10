const appEnv = require('./env');
const botConfig = appEnv.getService('bot_config');
const middleware = require('./conversation').middleware;

function initBots(app) {
  if (botConfig.settings.enabled.slack) {
    var Slack = require('./bot-slack')(middleware);
    // Slack.controller.middleware.receive.use(middleware.receive);
    Slack.bot.startRTM();
    console.log('Slack bot is live');
  }

  // Customize your Watson Middleware object's before and after callbacks.
  middleware.before = function(message, conversationPayload, callback) {
    console.log('before ', conversationPayload);

    conversationPayload.context = Object.assign({}, conversationPayload.context, {clienttype:"slack"});
    callback(null, conversationPayload);
  }

  middleware.after = function(message, conversationResponse, callback) {
    console.log('after');
    callback(null, conversationResponse);
  }
}

module.exports = initBots;