/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* jslint node: true, esversion: 6 */
'use strict'

const appEnv = require('./env');
const chatbotconfig = appEnv.getService('CHATBOT_CONFIG');
const wchconnector = require('sample-wch-node-connector');
const wchAuthoring = new wchconnector({
  tenantid: chatbotconfig.credentials.tenantid,
  endpoint: 'authoring',
  baseUrl: chatbotconfig.credentials.baseurl,
  credentials: {
    usrname: chatbotconfig.credentials.username,
    pwd: chatbotconfig.credentials.password
  },
  maxSockets: 10
});

const wchDelivery = new wchconnector({
  tenantid: chatbotconfig.credentials.tenantid,
  endpoint: 'delivery',
  baseUrl: 'https://my6.digitalexperience.ibm.com/api/8f032d79-a358-4825-af1b-d6cc169692c6'
});

module.exports.authoring = wchAuthoring;
module.exports.delivery = wchDelivery;