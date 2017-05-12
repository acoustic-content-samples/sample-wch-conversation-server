const appEnv = require('./env');
const botConfig = appEnv.getService('bot_config');
const middleware = require('./conversation').middleware;
const toneanalyzer = require('./toneanalyzer');

function initBots(app) {
  if (botConfig.settings.enabled.slack) {
    var Slack = require('./bot-slack')(middleware);
    // Slack.controller.middleware.receive.use(middleware.receive);
    Slack.bot.startRTM();
    console.log('Slack bot is live');
  }

  // Customize your Watson Middleware object's before and after callbacks.
  middleware.before = function(message, conversationPayload, callback) {
    // console.log('before ', conversationPayload);
    toneanalyzer.tone(message, (err, tone) => {

      let toneObjs = tone.document_tone.tone_categories.reduce((obj, category) => {

        let categoryTonesObj = category.tones.reduce((toneObjs, tone) => {
          toneObjs[tone.tone_name] = tone.score;
          return Object.assign({}, toneObjs);
        }, {});

        return Object.assign({}, obj, {[category.category_name]:categoryTonesObj});
      }, {});
      
      conversationPayload.context = Object.assign({}, conversationPayload.context, {clienttype:"slack", tone:toneObjs});
      callback(null, conversationPayload);
    });

  }

  middleware.after = function(message, conversationResponse, callback) {
    callback(null, conversationResponse);
  }
}

module.exports = initBots;