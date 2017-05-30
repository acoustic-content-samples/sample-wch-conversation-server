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
'use strict';

const appEnv = require('./env');
const toneanalyzerservice = appEnv.getService('wch_toneanalyzer');
const ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');

const toneanalyzer = new ToneAnalyzerV3({
  url: toneanalyzerservice.credentials.url,
  username: toneanalyzerservice.credentials.username,
  password: toneanalyzerservice.credentials.password,
  version_date: '2016-05-19'
});

/**
 * See: https://github.com/watson-developer-cloud/node-sdk/blob/master/toneanalyzer/v1.js
 *
 * Currently used methods:
 * 
 */
 
module.exports = toneanalyzer;