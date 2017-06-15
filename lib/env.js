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

const cfenv = require('cfenv');
const dch_vcap_local = require('../dch_vcap');

module.exports.settings = {
  "geolocationservice": {
    "enabled": true
  },
  "bot_config": {
    "enabled": {
      "developermode": false,
      "raspberry": true,
      "slack": true
    }
  },
  "wch_config": {
    "caching": true
  },
  "wch_conversation": {
    "workspace_id": {
      "en":"9db75ce4-a059-4f53-988d-de239eed10a0"
    }
  },
  "wch_toneanalyzer": {
    "enabled": true
  }
};

module.exports.credentials = cfenv.getAppEnv({
  vcap: {
    services: dch_vcap_local
  }
});
