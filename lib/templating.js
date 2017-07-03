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

'use strict';

const debug = require('debug')('wchbotserver:templating');

const Handlebars = require('handlebars');

Handlebars.registerHelper({
  eq: function (v1, v2) {
    return v1 === v2;
  },
  ne: function (v1, v2) {
    return v1 !== v2;
  },
  lt: function (v1, v2) {
    return v1 < v2;
  },
  gt: function (v1, v2) {
    return v1 > v2;
  },
  lte: function (v1, v2) {
    return v1 <= v2;
  },
  gte: function (v1, v2) {
    return v1 >= v2;
  },
  and: function (v1, v2) {
    return v1 && v2;
  },
  or: function (v1, v2) {
    return v1 || v2;
  }
});

const WchConversationTemplatingV1 = function () {};

WchConversationTemplatingV1.prototype.parseString = function (watsonData, templateString) {
  return new Promise((resolve, reject) => {
    let template = Handlebars.compile(templateString);
    let result = template(watsonData);
    resolve(result);
  });
}

WchConversationTemplatingV1.prototype.parseJSON = function (watsonData, templateObject) {
  return new Promise((resolve, reject) => {
    if (!templateObject) {
      return resolve(templateObject);
    }
    debug('templateObject %o');
    let template = Handlebars.compile(JSON.stringify(templateObject));
    let result = template({watsonData: watsonData});
    debug('result %o', result);
    resolve(JSON.parse(result));
  });
}

module.exports = new WchConversationTemplatingV1();