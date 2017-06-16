const debug = require('debug')('wchbotserver:interactivemessages');

module.exports = function(controller) {

    controller.on('error', function(err) {
      debug("err ", err);
    });

    controller.on('create_bot', function(bot, team) {
      debug("created bot %o", bot);
      debug("created team %o", team); 
      bot.startRTM();
    });

    debug('Configured interactive_message_callback');
    controller.on('interactive_message_callback', function(bot, trigger) {
        debug('Trigger interactive_message_callback %o', trigger);
           
        var message = {
            user: trigger.user,
            channel: trigger.channel,
            team: trigger.team.id,
            text: `...${trigger.actions[0].value}`,
            type: 'message'
        };

        controller.receiveMessage(bot, message);

        return false; // do not bubble event
        
    });

}