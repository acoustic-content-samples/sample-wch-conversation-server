/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
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

'use strict';

const express = require('express');
const router = express.Router();

const syncLogic = require('../lib/sync');

router.get('/intents', function(req, resp) {
  syncLogic.push({
    from: syncLogic.WCS,
    to: syncLogic.WCH
  }).then(status => resp.send(status));
  // conversation.message({
  // input: { text: '' },
  // workspace_id: 'bba2bb71-5b1d-482c-bee9-db752c8c46a9'
  //  }, function(err, response) {
  //      if (err) {
  //        console.error(err);
  //      } else {
  //        console.log(JSON.stringify(response, null, 2));
  //        resp.json(response);
  //      }
  // });

  
});

router.post('/', function(req, resp) {
  resp.send('Sync!');
});

router.get('/ping', function(req, resp) {
  resp.
  status(201).
  send('pong');
});

module.exports = router;