# WCH Conversation Server

Starter Kit to implement rich-featured, cross-channel & multi-language chat solutions with omni-channel content for messengers, websites and bots.

This starter kit is also used for the [WCH Robot Maker Kit](https://my.digitalexperience.ibm.com/58b9043c-6075-4fde-8090-ea22d9890922/mtl-website/index.html).

The conversational capabilites such as language understanding and dialog structure are implemented through the [Watson Conversation Service](https://www.ibm.com/watson/services/conversation/). Every content visible to the user of the chat is created and managed inside of [Watson Content Hub](https://www.ibm.com/de-de/marketplace/cloud-cms-solution). You can also use other cognitive services such as the Tone Analyzer to enrich the inital experience.

The sample currently supports multiple chat-interfaces:
1. A **REST API** for easy integration into websites or audio bots.
3. A **Slack** integration where you can either use a simple slack bot or create a rich featured Slack Application (Action Buttons, Emojis, Gifs, formatted content and more)
4. A **Facebook Messenger** bot leveraging text, action buttons and image capabilites.
5. An **Alexa** skill which you can enable through simple configuration. (Instructions follow soon)

To give you an idea what can be achieved with this solution:
![Slack Sample](/doc/SlackSampe_Min.gif)

## Core Idea
Most of the time the structure of your dialogs aren't changing. What frequently changes are the topics and things you talk about. So this means that you should implement a solution which allows content marketeers to make those changes.

The value of this proposed solution is _simple and powerful_: The Watson Conversation Service defines the flow & structure of the conversation. It represents the "technical brain" and stores no actual content shown to the users of the chatbot solution. The actual content is managed in our headless CMS called Watson Content Hub. Through a well known authoring UI we enable business users to createe & manage the chatbot content without any additional complexity compared to managing content for their websites.

| Watson Conversation Service | Watson Content Hub |
|---|---|
| <ul><li>Defines the conversational structure</li><li>Manages the state of conversations</li><li>"State Machine"</li><li>No awarness of the actual content</li><li>Possibility to add custom actions</li></ul> | <ul><li>Have rich content capablities</li><li>Reusable content in other applications</li><li>Omni-Channel (Create once publish everywhere)</li><li>Adapt to various output mediums (e.g. Screen, Audio, Text)</li><li>Use the context information from the conversation service for dynamic content</li><li>No training needed - you manage your content the same way as before</li><li>Easy to use Authoring UI</li></ul> |

## How does it work
This is also simple because WCS and WCH work well together through their rich REST APIs. First the utterances of the user are all going to the Watson Converation Services. It takes care of the natural language understanding and the context handling for each user. The results of WCS are then transformed dynamically into a search query against WCH. The result of the query then gives us the actual content we then map into the respective channel of the user.

For more information check out this [video](https://www.youtube.com/watch?v=bT1QgOV5jyY)

## Setup

### Initial remarks on the setup
You can basically host this server anywhere. Note that if you want to run the server locally you have the choice to encrypt your local credentials. Also to ease the process it's recommendet to use Bluemix for deployments since this is well tested.

### Requirements
- Node V8+
- You need a valid Blue ID
- You need an instance of the conversation service from Bluemix
- You need a Watson Content Hub account
### Optional Requirements
- You can add an instance of the tone analyzer service from Bluemix
- You can add an instance of the Google Geolocation Service
- You can add a Slackbot
- You can add a Slack Application
- You can add a MongoDB if you want to persist your chats

### Important Notes about the creation of Services
If you are planning to push the server to bluemix make sure to name the services as defined during your setup. Make sure that the `manifest.yml` only has the services you use. This step is not automated yet. The default values should be:
- for the Conversation Service `wch-conversation`

![Bluemix Services Image](/doc/4%20-%20Created%20Services.PNG)

Based on the capabilites you want to use adjust the `manifest.yml` accordingly. See below the minimal setup required. Note: With the environment variable `APP_SETTINGS` you can change the name of the settings json file for multi-stage scenarios.

#### Sample manifest.yml

```yaml
applications:
- path: .
  memory: 256M
  buildpack: sdk-for-nodejs
  instances: 1
  domain: mybluemix.net
  name: wch-conv-int-srv
  host: wch-conv-int-srv
  disk_quota: 1024M
  services:
  - wch_config
  - wch-conversation
  env:
    BX_CREDS: true
    APP_SETTINGS: 'app_settings_prod'
```

### Gather all credentials

Based on your selected setup see the instructions on how to get to the credentials. Note them down. You will need them once you are running the `npm run manageCreds` script.

1. Watson Content Hub - Login into your tenant. Click on your name and open 'Hub Setup'. There you find your API URL and Tenant Id. 
2. Watson Conversation Service - [Follow the instructions in the official documentation on how to get the service credentials][bluemixapi]
3. **Optional:** Watson Tone Analyzer - [Follow the instructions in the official documentation on how to get the service credentials][bluemixapi]
4. **Optional:** Watson Language Translator - [Follow the instructions in the official documentation on how to get the service credentials][bluemixapi]
5. **Optional:** Slack Application - [Follow the instructions in the official documentation on how to setup an Slack Application and obtaining a bot key][slackapi]
6. **Optional:** Google Geolocation API - [Follow the instructions in the official documentation to get an API Key][geoapi]
7. **Optional:** Facebook Messenger - [Follow the instructions in the official documentation to setup a Webhook][fbwebhook]

[fbwebhook]:https://developers.facebook.com/docs/messenger-platform/getting-started/webhook-setup
[bluemixapi]:https://www.ibm.com/watson/developercloud/doc/common/getting-started-credentials.html
[slackapi]:https://api.slack.com/slack-apps
[geoapi]:https://developers.google.com/maps/documentation/geolocation/get-api-key

### Server Setup
1. **[Required]** Clone the repository & install the dependencies:
```
git clone https://github.com/ibm-wch/sample-wch-conversation-server.git
cd ./sample-wch-conversation-server
npm install
```

2. **[Required]** If you want to start the server locally you have to pass in the credentials to the dependent services. In order to setup the complete sample simply run `npm run manageCreds`. This will ask for all credentials needed.<br/><br/>If you also want to setup the content model for WCH run `npm run pushWCH`.<br/><br/>*NOTE:* If you encrypted your local credentials file you can always rerun the manageCreds command to make changes.

3. **[Required]** In order to sync your conversation model with WCH execute the `npm run sync` command. This should create the corresponding taxonmies in your WCH tenant.

4. **[Required]** If you want to start the server locally you have to pass in the credentials to the dependent services. In order to setup the complete sample simply run `npm run manageCreds`. This will ask for all credentials needed.<br/><br/>If you also want to setup the content model for WCH run `npm run pushWCH`.<br/><br/>*NOTE:* If you encrypted your local credentials file you can always rerun the manageCreds command to make changes

5. **[Required]** To test if everything works as expected you should start the server by running `npm run devDebug`. This will start a nodemon server with tracing/logging enabled. If you don't want tracing enabled in the future simply run `npm run dev`. After startup you should be able to call the endpoint `POST http://localhost:6001/rest/message Body: {"input":"What is WCH?","user":"Test" }` and get a JSON response containing a text field with content from Watson Content Hub.<br/>

![Check Setup](/doc/Check.gif)

6. **[Optional]** If you like you can push the sample server on bluemix by running `bx cf push`. But before please make sure to change the hostname of the application in the `manifest.yml`. Also you have to configure the credentials on bluemix. Therefore sipmly run `npm run addGeoSrv`, `npm run addWchSrv`, `npm run addBotSrv`, `npm run addFbSrv`, `addAlexaSrv` and `npm run addDBSrv`. (Of course you can skip over those services you've disabled during the setup. Just make sure to remove them from the `manifest.yml`)

7. **Done.** Enjoy your chatbot. Feel free to make changes and personalize your chatbot!
  
#### Manage your content in Watson Content Hub

This server is configured to fetch the content shown to users from WCH. This is based on the concept of syncing all intents, entities, dialog_nodes and actions from the conversation service to WCH. In order to trigger a sync start the application in the developermode. You can do this by changing the respective flag in the `app_settings.json` file to `true`. Afterwards you can tell your bot: `To push my changes to WCH`. This should do the job and afterwards you should see your changes in the taxonomy section of WCH.

When using the sample you also have predefined content types to create your chatbot content. The types are: ChatOutputText, ChatAttachment, ChatFollowup and ChatActionButton.

The content type `ChatOutputText` is at the core when creating an answer. Here you define the required text based answer to a user message. You can add answer variations in here. This is also the place to select the dialog states where this answer should be used.

`ChatAttachments` contain all rich content variations your channels support. E.g. images, author information, videos & more. This is the place to define enrichments to your answer. Since those are then referenced to a ChatOutputText you can reuse your ChatAttachment in multiple answers.

`ChatFollowups` are used to defined dialog triggered special actions. E.g. a ChatFollowup can be used when we want to ask the user for his name, but only the first time the user interacts with the bot. The contentstructure is the same as for a ChatOutputText.

`ChatActionButton` define Quick Replies you can add to Slack and Facebook (and potentially your custom developed chatbot). They offer a convenient mechanism to offer your user common answers.

**Note:** This is a potentially expensive operation - so disable developermode for production use cases!

### Resources

API Explorer reference documentation: https://developer.ibm.com/api/view/id-618

Watson Content Hub developer center: https://developer.ibm.com/wch/

Watson Content Hub forum: https://developer.ibm.com/answers/smartspace/wch/
