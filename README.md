# WCH Conversation Server

This is a starter Kit to implement rich-featured, cross-channel & multi-language chat bots for messengers, websites and bots. This starter kit is also used for the [WCH Robot Maker Kit](https://my.digitalexperience.ibm.com/58b9043c-6075-4fde-8090-ea22d9890922/mtl-website/index.html).

The conversational capabilites such as language understanding and dialog structure are implemented through the [Watson Conversation Service](https://www.ibm.com/watson/services/conversation/). Every content visible to the user of the chat is created and managed inside of [Watson Content Hub](https://www.ibm.com/de-de/marketplace/cloud-cms-solution). Hence these two cloud-based application are essential for this solution. There are also other (optional) services included to enrich the out-of-the-box experience such as the Tone Analyzer or Language Translator.

The sample currently supports three chat-interfaces:
1. A REST based text only bot for usage in bots and other scenarios where you only are able to output text or audio. If you are interested you can [check out the instructions page here](https://my.digitalexperience.ibm.com/58b9043c-6075-4fde-8090-ea22d9890922/mtl-website/index.html) to create your own WCH Robot!
2. A slack based bot leveraging the full capability set of messenger (Action Buttons, Emojis, Gifs, formatted content and more)
3. A facebook messenger bot leveraging text, action buttons and image capabilites.

Currently the demo content shipped with the started Kit is:
![Slack Sample](/doc/SlackSampe_Min.gif)

## Core Idea
The value of this solution is simple and powerful: We let the Watson Conversation Service define the flow & structure of the conversation. All content is created & managed in Watson Content Hub and retrieved dynamically based on the current dialog state. For this we are using the rich search capabilites from WCH. Therefore we can easily enhance the conversation with images, videos, emojis and more. It's also possible to make changes to the content on the fly and have a central point to do so. For more information check out this [video](https://www.youtube.com/watch?v=bT1QgOV5jyY)

| Watson Conversation Service | Watson Content Hub |
|---|---|
|  <ul><li>Defines the conversational structure</li><li>Manages the state of conversations</li><li>"State Machine"</li><li>Unaware of the actual response content</li><li>Possibility to add custom actions</li></ul> | <ul><li>Have rich content capablities</li><li>Reusable content in other applications</li><li>"Chross-Channel"</li><li>Adapt to various output mediums (e.g. Screen, Audio, Text)</li><li>Use the context information from the conversation service for dynamic content</li></ul> |

## Setup

### Initial remarks on the setup
This server can be hosted locally on your rasperry pi for the complete chatbot demo. Simply execute all following steps on your raspberry. As an alternative you can also configure the server to get hosted on Bluemix. Hosting the sample on bluemix is only recommended if you want to use advanced features like Slack Webhooks.

### Requirements
- Node V6+
- You need a valid Blue ID
- You need an instance of the conversation service from Bluemix
- You need a tenant for Watson Content Hub
### Optional Requirements
- You can add an instance of the tone analyzer service from Bluemix
- You can add an instance of the Google Geolocation Service
- You can add a Slackbot token
- You can add a Slack Application
- You can add a MongoDB if you want to persist your chats

### Important Notes about the creation of Services
If you are planning to push the server to bluemix make sure to name the services provided by bluemix as defined in the dch_vcap_sample.json. In detail:
- Conversation Service name : `wch-conversation`
- Tone Analyzer Service name : `wch-toneanalyzer`

![Bluemix Services Image](/doc/4%20-%20Created%20Services.PNG)

### Gather all credentials
1. Watson Content Hub - Login into your tenant. Click on your name and open 'Hub Setup'. There you find your API URL and Tenant Id. 
2. Watson Conversation Service - [Follow the instructions in the official documentation on how to get the service credentials][bluemixapi]
3. Watson Tone Analyzer - [Follow the instructions in the official documentation on how to get the service credentials][bluemixapi]
4. Watson Language Translator - [Follow the instructions in the official documentation on how to get the service credentials][bluemixapi]
5. Slack Application - [Follow the instructions in the official documentation on how to setup an Slack Application and obtaining a bot key][slackapi]
6. Google Geolocation API - [Follow the instructions in the official documentation to get an API Key][geoapi]

[bluemixapi]:https://www.ibm.com/watson/developercloud/doc/common/getting-started-credentials.html
[slackapi]:https://api.slack.com/slack-apps
[geoapi]:https://developers.google.com/maps/documentation/geolocation/get-api-key

### Server Setup
1. **[Required]** Clone the repository & install dependencies:
```
git clone https://github.com/ibm-wch/sample-wch-conversation-server.git
cd ./sample-wch-conversation-server
npm install
```

2. **[Required]** If you want to start the server locally you have to pass in the credentials to the dependent services. In order to setup the complete sample simply run `npm run setupSample`. This will ask for all possible credentials and afterwards initializes the Watson Conversation Service and Watson Content Hub with the sample dialog and the required content types.<br/><br/>If you just want to setup the credentials simply run `npm run setupCredentials` or you can use `dch_vcap_sample.json` as a reference and fill in the parameters manually.<br/><br/>*NOTE:* If you are not interessted in the slack integration of this sample you can omit the bot_config completely.

3. **[Required]** To test if everything works as expected you should start the server by running `npm run devDebug`. This will start a nodemon server with tracing/logging enabled. If you don't want tracing enabled in the future simply run `npm run dev`. After startup you should be able to call the endpoint `POST http://localhost:6001/rasp/message Body: {"input":"What is WCH?","user":"Test" }` and get a JSON response containing a text field with content from Watson Content Hub.<br/>

![Check Setup](/doc/Check.gif)

4. **[Optional]** If you like you can push the sample server on bluemix by running `bx cf push`. But before please make sure to change the hostname of the application in the 'manifest.yml'. Also you have to configure the credentials on bluemix. Therefore sipmly run `npm run addGeoSrv`, `npm run addWchSrv`, `npm run addBotSrv` and `npm run addDBSrv`.

5. **Done.** Enjoy the demo. Feel free to make changes and create your own chatbot!  

#### Node Red
Part of the sample is also a Node RED flow. Currently this flow is optimized for the Maker Kit to run on a Raspberry Pi. So if you want to run this part on Windows on Mac you might have to change a thing or two.

### Resources

API Explorer reference documentation: https://developer.ibm.com/api/view/id-618

Watson Content Hub developer center: https://developer.ibm.com/wch/

Watson Content Hub forum: https://developer.ibm.com/answers/smartspace/wch/
