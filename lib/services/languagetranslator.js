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
const languagetranslatorserivce = appEnv.credentials.getService('wch-languagetranslator');
const LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');

const languagetranslator = appEnv.settings.wch_languagetranslator.enabled ? new LanguageTranslatorV2({
  url: languagetranslatorserivce.credentials.url,
  username: languagetranslatorserivce.credentials.username,
  password: languagetranslatorserivce.credentials.password
}) : null;

/**
 * See: https://github.com/watson-developer-cloud/node-sdk#language-translator
 *
 * Currently used methods:
 *   -  identify
 *
 */

module.exports = languagetranslator;
