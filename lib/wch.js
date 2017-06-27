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
const chatbotconfig = appEnv.credentials.getService('wch_config');
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
  baseUrl: chatbotconfig.credentials.baseurl
});

module.exports.authoring = wchAuthoring;
module.exports.delivery = wchDelivery;
module.exports.hosturl = chatbotconfig.credentials.hosturl;