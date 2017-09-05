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

/**
 * Helpers to create conditional statements in content.
 */
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

/**
 * If we already have a template string use this method to call the compile method.
 * @param  {Object} watsonData     Result of a call against the conversation service
 * @param  {String} templateString The template string were we want to insert content form the conversation service
 * @return {String}                The parsed template string
 */
WchConversationTemplatingV1.prototype.parseString = function (watsonData, templateString) {
  return new Promise((resolve, reject) => {
    debug('templateString %s', templateString);
    let template = Handlebars.compile(templateString);
    // Here we just pass the watsonData Object in. We could make this easier for
    // the Content Author by extracting the most used values.
    let result = template({watsonData});
    resolve(result);
  });
}

/**
 * If we have a handlebars template as an JavaScript object.
 * @param  {Object} watsonData     Result of a call against the conversation service
 * @param  {Object} templateObject The handlebar template as an object
 * @return {Object}                The parsed template as an object
 */
WchConversationTemplatingV1.prototype.parseJSON = function (watsonData, templateObject) {
  return new Promise((resolve, reject) => {
    if (!templateObject && typeof templateObject !== 'object') {
      debug('templateObject not an object', templateObject);
      return resolve(templateObject);
    }
    debug('templateObject %o', templateObject);
    let template = Handlebars.compile(JSON.stringify(templateObject));
    // Here we just pass the watsonData Object in. We could make this easier for
    // the Content Author by extracting the most used values.
    let result = template({watsonData});
    debug('result %o', result);
    resolve(JSON.parse(result));
  });
}

module.exports = new WchConversationTemplatingV1();
