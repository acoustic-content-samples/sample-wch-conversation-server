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

  if (botConfig.settings.enabled.raspberry) {
    var Raspberry = require('./bot-raspberry')(middleware);
    // Slack.controller.middleware.receive.use(middleware.receive);
    console.log('Raspberry.controller.router ', Raspberry.controller.router);
    app.use('/rasp', Raspberry.controller.router);
  }

  // Customize your Watson Middleware object's before and after callbacks.
  middleware.before = function(message, conversationPayload, callback) {
  // console.log('before ', conversationPayload);
    let _conversationPayload = conversationPayload;
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
      _conversationPayload.context = Object.assign({}, _conversationPayload.context, {clienttype:"slack", tone:toneObjs});
    });
    
    let geolocationPromise = (_conversationPayload.context && _conversationPayload.context.setlocation === true) ?
      geolocation.geocode({
        address: message.text
      }).
      asPromise().
      catch(err => console.log("Geolocation Error ", err)).
      then(response => {
        console.log(JSON.stringify(response.json.results,null,1));
        // lat, lng
        _conversationPayload.context = Object.assign({}, _conversationPayload.context, {geolocation: response.json.results[0].geometry.location});
      })
    : Promise.resolve();

    Promise.all([tonePromise, geolocationPromise]).
    catch(err => console.log('err ', err)).
    then(() => {
      callback(null, _conversationPayload);
    });
  }

  middleware.after = function(message, conversationResponse, callback) {
    callback(null, conversationResponse);
  }
}

module.exports = initBots;