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

const conversation = require('../lib/conversation');
const wch = require('../lib/wch').delivery;

function postMessage(params) {
  return new Promise((res, rej) => {
    conversation.message({
      workspace_id: conversation.workspace_en,
      export: true,
      input: {text: params.input},
      context: params.context
    }, 
    (err, resp) => {
      if(err) {
        console.log(err);
        rej(err);
      }
      res(resp);
    });
  }); 
}

// Process the conversation response.
function processResponse(response) {
  return new Promise((res, rej) => {
    let textKey = response.output.text[0];
    let queryParams = {
      query:'classification:content'
    };

    wch.search.query(queryParams).
    then(res).
    catch(rej);
  });
}

function getNodeOutputText(resp) {
  return new Promise((res, rej) => {
    console.log(resp.output.text[0]);
    res(resp);
  });
}

router.post('/message', function(req, resp, next) {
  console.log("reqBody ", req.body);

  postMessage(req.body).
  then(getNodeOutputText).
  then(processResponse).
  then(result => {
    resp.
    status(200).
    json(result);
  }).
  catch(err => {
    next(err);
  });
});

router.get('/ping', function(req, resp) {
  resp.
  status(201).
  send('pong');
});

module.exports = router;