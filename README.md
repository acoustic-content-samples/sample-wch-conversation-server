# WCH Conversation Integration Server

Starter Kit for a server side implementation on how to create an cogntitive advisor based on the Watson Conversation Service and Watson Content Hub. This sample offers convenience features to sync intents & entities with Watson Content Hub and is based on the Botkit framework which makes it easy to extend to an cogntitive advisor solution running on Slack, Facebook Messenger, Cisco Spark, Twilio IP Messanging & Microsoft Bot Framework.

Currently this sample is configured to be used either in an bot scenario with an robot or with slack.

## Core Idea
The value of this solution is simple and powerful: We let the Watson Conversation Service define the flow & structure of the conversation. All content is created & managed in Watson Content Hub and retrieved dynamically for the right response node. Therefore we can easily enhance the conversation responses with images, videos, ... and switch the language of the conversation as needed.

## Setup
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

### Initalize the Conversation Service with the sample data
This step is optional. If you are already familliar with the conversation service you can either use an existing dialog or create a new one matching your needs.

### Initalize Watson Content Hub with the required content types
TODO

### Initalize Watson Content Hub upload the sample content
TODO

### Link your Watson Conversation Service instance with your Watson Content Hub Tenant
TODO

### Local Server Setup
1. **[Required]** Clone the repository:
```
git clone https://github.ibm.com/sterbling/wch-conversation-integration-server.git
```

2. **[Required]** If you want to start the server locally you have to create a valid `dch_vcap.json` file in the root directory of the application. As a starting point you can use `dch_vcap_sample.json` where you just have to put in all credentials needed.

*NOTE:* If you are not interessted in the slack integration of this sample you can omit the bot_config completely.

**Example:**
```json
{
    "tone_analyzer": [
        {
            "credentials": {
                "url": "<Copy the credentials from bluemix>",
                "username": "<Copy the credentials from bluemix>",
                "password": "<Copy the credentials from bluemix>"
            },
            "syslog_drain_url": null,
            "label": "tone_analyzer",
            "provider": null,
            "plan": "standard",
            "name": "wch-toneanalyzer",
            "tags": [
                "watson",
                "ibm_created",
                "ibm_dedicated_public",
                "lite"
            ]
        }
    ],
    "conversation": [
        {
            "credentials": {
                "url": "<Copy the credentials from bluemix>",
                "username": "<Copy the credentials from bluemix>",
                "password": "<Copy the credentials from bluemix>"
            },
            "syslog_drain_url": null,
            "label": "conversation",
            "provider": null,
            "plan": "standard",
            "name": "wch-conversation",
            "tags": [
                "watson",
                "ibm_created",
                "ibm_dedicated_public",
                "lite"
            ]
        }
    ],
    "user-provided": [
        {
            "credentials": {
                "baseurl": "<Copy the baseUrl from the WCH Authoring UI>",
                "hosturl": "<Copy the hosturl from the WCH Authoring UI>",
                "tenantid": "<Copy the tenantid from the WCH Authoring UI>",
                "username": "<A valid wch user>",
                "password": "<The password>"
            },
            "syslog_drain_url": "",
            "label": "user-provided",
            "name": "wch_config",
            "tags": []
        },
        {
            "credentials": {
                "clientid": "<Client ID of your Slack Application>",
                "clientsecret": "<Client Secret of your Slack Application>",
                "verificationtoken": "<Verification Token of your Slack Application>"
            },
            "syslog_drain_url": "",
            "label": "user-provided",
            "name": "bot_config",
            "tags": []
        }
    ]
}
```
3. **[Optional]** If you want to start the server call `npm run devDebug` for a nodemon server with tracing enabled for the complete application. If you don't want tracing enabled simply run `npm run dev`. After startup you should be able to call the endpoint /rasp/message and get a JSON response containing a text field with the answer.
