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

/* eslint camelcase: 0 */
'use strict';

const appEnv = require('../env');
const conversationservice = appEnv.credentials.getService('wch-conversation');
const ConversationV1 = require('watson-developer-cloud/conversation/v1');

const workspace_en = appEnv.settings.wch_conversation.workspace_id.en;
const caching = appEnv.settings.wch_config.caching;

const middleware = require('botkit-middleware-watson')({
  workspace_id: workspace_en,
  url: conversationservice.credentials.url,
  username: conversationservice.credentials.username,
  password: conversationservice.credentials.password,
  version_date: ConversationV1.VERSION_DATE_2017_04_21
});
const conversation = new ConversationV1({
  workspace_id: workspace_en,
  url: conversationservice.credentials.url,
  username: conversationservice.credentials.username,
  password: conversationservice.credentials.password,
  version_date: ConversationV1.VERSION_DATE_2017_04_21
});
conversation.workspace_en = workspace_en;
conversation.caching = caching;
conversation.middleware = middleware;

/**
 * See: https://github.com/watson-developer-cloud/node-sdk/blob/master/conversation/v1.js
 *
 * Currently used methods:
 *   - message
 *   - listWorkspaces
 *   - getWorkspace
 *   - createIntent
 *   - getIntents
 *   - createEntity
 *   - getEntities
 *
 */

module.exports = conversation;