# WCH Conversation Integration Server

Starter Kit for a server side implementation on how to create an cogntitive advisor based on the Watson Conversation Service and Watson Content Hub. This sample offers convenience features to sync intents & entities with Watson Content Hub and is based on the Botkit framework which makes it easy to extend to an cogntitive advisor solution running on Slack, Facebook Messenger, Cisco Spark, Twilio IP Messanging & Microsoft Bot Framework.

Currently this sample is configured to be used either in an bot scenario with an robot or with slack.

## Core Idea
The value of this solution is simple and powerful: We let the Watson Conversation Service define the flow & structure of the conversation. All content is created & managed in Watson Content Hub and retrieved dynamically for the right response node. Therefore we can easily enhance the conversation responses with images, videos, ... and switch the language of the conversation as needed.

| Watson Conversation Service | Watson Content Hub |
|---|---|
|  - Defines the conversational structure
   - Manages the state of conversations
   - "State Machine"
   - Unaware of the actual response content
   - Possibility to add custom actions | 
   - Have rich content capablities
   - Reusable content in other applications
   - "Chross-Channel"
   - Adapt to various outout mediums (e.g. Screen, Audio, Text)
   - Use the context information from the conversation service for dynamic content  |

## Setup

### Initial remarks on the setup
This server can be hosted locally on your rasperry pi for the complete chatbot demo. Simply execute all following steps on your raspberry. As an alternative you can also configure the server to get hosted on Bluemix. Hosting the sample on bluemix is only recommended if you want to use advanced features like Slack Webhooks.

### Requirements
- Node V6+
- You need a valid Blue ID
- You need an instance of the conversation service from Bluemix
- You need a tenant for Watson Content Hub
- *[Optional]* You need an instance of the tone analyzer service from Bluemix
- *[Optional]* You need an instance of the Google Geolocation Service
- *[Optional]* You need an Slackbot token
- *[Optional]* You need a Slack Application
- *[Optional]* You need a MongoDB URL if you want to persist your chats

### Important Notes about the creation of Services
In order to use the sample out-of-the box please make sure to name the  services provided by bluemix as defined in the dch_vcap_sample.json. In detail:
- Conversation Service name : `wch-conversation`
- Tone Analyzer Service name : `wch-toneanalyzer`

### Gather all credentials
1. Watson Content Hub - Login into your tenant. Click on your name and open 'Hub Setup'. There you find your API URL and Tenant Id. 
2. Watson Conversation Service - [Follow the instructions in the official documentation on how to get the service credentials][bluemixapi]
3. Watson Tone Analyzer - [Follow the instructions in the official documentation on how to get the service credentials][bluemixapi]
4. Slack Application - [Follow the instructions in the official documentation on how to setup an Slack Application and obtaining a bot key][slackapi]
5. Google Geolocation API - [Follow the instructions in the official documentation to get an API Key][geoapi]

[bluemixapi]:https://www.ibm.com/watson/developercloud/doc/common/getting-started-credentials.html
[slackapi]:https://api.slack.com/slack-apps
[geoapi]:https://developers.google.com/maps/documentation/geolocation/get-api-key

### Server Setup
1. **[Required]** Clone the repository:
```
git clone https://github.com/ibm-wch/sample-wch-conversation-integration-server.git
```

2. **[Required]** If you want to start the server locally you have to pass in the credentials to the dependent services. In order to setup the complete sample simply run `npm run setupSample`. This will ask for all possible credentials and afterwards initializes the Watson Conversation Service and Watson Content Hub with the sample dialog and the required content types.
 
If you just want to setup the credentials simply run `npm run setuplocal` or you can use `dch_vcap_sample.json` as a reference and fill in the parameters manually.

*NOTE:* If you are not interessted in the slack integration of this sample you can omit the bot_config completely.

3. **[Optional]** If you want to start the server call `npm run devDebug` for a nodemon server with tracing enabled for the complete application. If you don't want tracing enabled simply run `npm run dev`. After startup you should be able to call the endpoint `/rasp/message` and get a JSON response containing a text field with the answer.

4. **[Optional]** If you like you can push the sample server on bluemix by running `bx cf push`. But before please make sure to change the hostname of the application in the 'manifest.yml'. Also you have to configure the credentials on bluemix. Therefore sipmly run `npm run addGeoSrv`, `npm run addWchSrv`, `npm run addBotSrv` and `npm run addDBSrv`.

5. **Done.** Enjoy the demo. Feel free to make changes and create your own chatbot!  

###Resources

API Explorer reference documentation: https://developer.ibm.com/api/view/id-618

Watson Content Hub developer center: https://developer.ibm.com/wch/

Watson Content Hub forum: https://developer.ibm.com/answers/smartspace/wch/