const debug = require('debug')('wchbotserver:interactivemessages');

module.exports = function(controller) {

    debug('Configured interactive_message_callback');
    controller.on('interactive_message_callback', function(bot, trigger) {
        debug('Trigger interactive_message_callback %o', trigger);
        let { id, name } = bot.identifyBot();
        debug('bot ID ', id);
        debug('chatbotpersona ', name);
        
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