const appEnv = require('./env');
const botConfig = appEnv.getService('bot_config');
const middleware = require('./conversation').middleware;
const toneanalyzer = require('./toneanalyzer');
const geolocation = require('./geolocation');

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
  
  let tonePromise = new Promise((resolve, reject) => {
    toneanalyzer.tone(message, (err, tone) => {
      if(err) reject(err);
      resolve(tone);
    });
  }).
  catch(err => console.log("Toneanalyzer Error ", err)).
  then(tone => {
    let toneObjs = tone.document_tone.tone_categories.reduce((obj, category) => {
        let categoryTonesObj = category.tones.reduce((toneObjs, tone) => {
          toneObjs[tone.tone_name] = tone.score;
          return Object.assign({}, toneObjs);
        }, {});
        return Object.assign({}, obj, {[category.category_name]:categoryTonesObj});
      }, {});
    conversationPayload.context = Object.assign({}, conversationPayload.context, {clienttype:"slack", tone:toneObjs});
  });

  let geolocationPromise = (conversationPayload.context && conversationPayload.context.setlocation === true) ?
  geolocation.geocode({
    address: message.text
  }).
  asPromise().
  then(response => {
    console.log(JSON.stringify(response.json.results,null,1));
    // lat, lng
    conversationPayload.context = Object.assign({}, conversationPayload.context,{geolocation: response.json.results[0].geometry.location});
  }) : 
  Promise.resolve();

  Promise.all([tonePromise, geolocationPromise]).
  then(() => callback(null, conversationPayload));
  }

  middleware.after = function(message, conversationResponse, callback) {
    callback(null, conversationResponse);
  }
}

module.exports = initBots;