const debug = require('debug')('wchbotserver:rtm_manager');

module.exports = function(controller) {

    let managed_bots = {};

    let manager = {
        start: function(bot) {

            if (managed_bots[bot.config.token]) {
                debug('Start RTM: already online');
            } else {
                bot.startRTM(function(err, bot) {
                    if (err) {
                        debug('Error starting RTM:', err);
                    } else {
                        managed_bots[bot.config.token] = bot.rtm;
                        debug('Start RTM: Success');
                    }
                });
            }
        },
        stop: function(bot) {
          if (managed_bots[bot.config.token] && managed_bots[bot.config.token].rtm) {
            debug('Stop RTM: Stopping bot');
            managed_bots[bot.config.token].closeRTM()
          }
        },
        remove: function(bot) {
          debug('Removing bot from manager');
          delete managed_bots[bot.config.token];
        },
        reconnect: function() {

          debug('Reconnecting all existing bots...');
          controller.storage.teams.all(function(err, list) {

              if (err) {
                  throw new Error('Error: Could not load existing bots:', err);
              } else {
                  for (var l = 0; l < list.length; l++) {
                    debug('Reconnecting %o', Object.assign({id:list[l].id}, list[l].bot));
                    manager.start(controller.spawn(Object.assign({id:list[l].id}, list[l].bot)));
                  }
              }

          });

        }
    }

    controller.on('error', function(err) {
      debug("err ", err);
    });

    controller.on('spawned', function(bot) {
      debug("spawned bot %o", bot);
    });

    controller.on('create_bot', function(bot, team) {
      debug("created bot %o", bot);
      debug("created team %o", team); 
      manager.start(bot);
    });

    // Capture the rtm:start event and actually start the RTM...
    controller.on('rtm_open', function(config) {
      debug('rtm_open %o', config);
    });

    //
    controller.on('rtm_close', function(bot) {
      debug('rtm_close %o', bot);
    });

    return manager;

}