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

'use strict'

const debug = require('debug')('wchbotserver:wchconversation');
const crypto = require('crypto');
const fs = require('fs');
const hash = crypto.createHash('md5');
const arrayutils = require('./utils/arrayutils');
const NodeCache = require('node-cache');

const wch = require('./services/wch');
const wchDelivery = require('./services/wch').delivery;
const templating = require('./templating');

/**
 * Method to generate a hash key for the current message state.
 * TODO: For improvement it would be better to filter out irrelevant stuff from the context
 * instead of the current approach of including the elements.
 *
 * @param  {Object} watsonData     The response from the conversation service
 * @param  {String} hashType       The hash method to use. Default type is 'md5'.
 * @param  {String} digestEncoding Encoding to use for the hash. Default is 'base64'.
 * @return {Promise}               When the Promise resolves the hash value as a String is returned.
 */
const generateMD5Key = function (watsonData, hashType, digestEncoding) {
  let {intents, entities, output, context} = watsonData;
  let generalContext = {
    clienttype: context.clienttype,
    wchid: context.wchid,
    username: context.username,
    outputlang: context.outputlang,
    chatbotpersona: context.chatbotpersona,
    askedContactDetails: context.askedContactDetails,
    lastIntent: context.lastIntent,
    nodename: context.nodename,
    setoutputlang: context.setoutputlang
  };

  let _encoding = digestEncoding || 'base64';
  let _hashType = (crypto.getHashes().indexOf(hashType) > -1) ? hashType : 'md5';
  return new Promise((resolve, reject) => {
    try {
      let hash = crypto.createHash(_hashType)
        .update(JSON.stringify({
          intents,
          entities,
          output,
          generalContext
        }), 'utf8')
      .digest(_encoding);
      resolve(hash);
    }
    catch (err) {
      throw new Error('Hash creation failed');
    }
  })
  .catch(err => reject(err));
}

/**
 * Method used to filter down for the best search results from WCH. Therefore
 * we first filter for all documents with the highest scoring & afterwards take the most
 * unspecific answer to the question.
 * @param  {Object} searchresult The answer from WCH based on the search query
 * @return {Promise}             When the Promise resolves the filteretd list of searchresults is returned.
 */
const cleanupAndShuffleResults = function (searchresult) {
  return new Promise((resolve, reject) => {
    let {numFound, documents} = searchresult;
    if (numFound > 1) {
      // The highest store is the first element
      let highestScore = documents[0].score;
      let minCount = 9999999;
      let filtered = documents
      .filter(ele => ele.score === highestScore)
      .map(ele => {
        // All elements have the same score now. Filter for content items
        // with the smallest amount of filter categories since that's the
        // most unspecific one...
        let { document: { elements: { filter } } } = ele;
        let length = (filter && filter.categories) ? filter.categories.length : 0;
        if (length < minCount) {
          minCount = length;
        }
        return {origin: ele, transf: length};
      })
      .filter(x => x.transf === minCount)
      .map(ele => ele.origin);

      debug('Filtered list %o', filtered);
      arrayutils.shuffle(filtered);
      searchresult.documents = filtered;
    }
    resolve(searchresult);
  });
}

/**
 * Searches for location specifc content in WCH to the current conversational state.
 * @param  {Object} watsonData The response from the conversation service
 * @return {Promise}           When the promise resolves the enriched search result from WCH is returned.
 */
const processLocationResponse = function (watsonData) {
  return new Promise((resolve, reject) => {
    let { context, output, intents, entities, context: {nodename}, output: {required = []} } = watsonData;

    if (!context.geolocation || !context.geolocation.lat || !context.geolocation.lng) {
      debug('No Location yet.');
      return resolve({searchResult: {numFound: 0, documents: []}});
    }

    let filterNodename =  (nodename)?`"${nodename}"^20`:'';

    let requiredEntities = required.reduce((resarry, reqEntitiy) => {
      let entiyValues = entities[reqEntitiy] || context[reqEntitiy];
      return (entiyValues) ? resarry.concat(entiyValues.map(entity => (`+"${entity.value}"`))) : resarry;
    }, []);

    let optionalEntities = entities
      .filter(entity => !required.includes(entity.entity))
      .map(entity => `"${entity.value}"^10`);

    let operator = (requiredEntities.length > 0)? 'AND' : 'OR';
    let queryEntities = requiredEntities.concat(optionalEntities);
    queryEntities.push(`"${context.chatbotpersona}"^30`); // Persona
    let queryParams = {
      query: `classification:content ${operator} categoryLeaves:(${queryEntities.join(' ')} ${filterNodename})`,
      facetquery: [
        `categoryLeaves:("${output.nodes_visited[output.nodes_visited.length-1]}")`,  // Current Conversation Node
        `locale:"${context.outputlang || 'en'}"`
      ],
      spacialsearch: {
        position: context.geolocation,
        distance: 5,
        sort: 'desc'
      },
      fields: ['id', 'name', 'document:[json], score']
    };
    debug('spatialQueryParams %o', queryParams);
    wchDelivery.search
    .query(queryParams)
    .catch(reject)
    .then(cleanupAndShuffleResults)
    .catch(reject)
    .then(searchResult => templating.parseJSON(watsonData, searchResult))
    .catch(reject)
    .then(processAttachments)
    .catch(reject)
    .then(respSet => templating.parseJSON(watsonData, respSet))
    .catch(reject)
    .then(resolve);
  });
}

/**
 * Fetches the list of possible responses from WCH based on the current dialog state.
 * @param  {Object} watsonData The response from the conversation service
 * @return {Promise}           When the promise resolves the enriched search result from WCH is returned.
 */
const processConversationResponse = function (watsonData) {
  return new Promise((resolve, reject) => {
    let { context, output, intents, entities, context: {nodename}, output: {required = []} } = watsonData;

    let filterNodename =  (nodename)?`"${nodename}"^20`:'';
    debug('Required entities %o', required);
    debug('Entities %o', entities);
    let requiredEntities = required.reduce((resarry, reqEntitiy) => {

      let entityValues = entities.filter(ele => ele.entity === reqEntitiy);
      if(entityValues.length === 0) {
        // TODO: Check if typeof context[reqEntitiy] === 'String'
        // Then create the array manually
        entityValues = context[reqEntitiy] || [];
      }
      debug('Required entities for entitiy %s %o', reqEntitiy, entityValues);
      debug('entities[reqEntitiy] %o', entities.filter(ele => ele.entity === reqEntitiy));
      debug('context[reqEntitiy] %o', context[reqEntitiy]);
      return (entityValues) ? resarry.concat(entityValues.map(entity => (`+"${entity.value}"`))) : resarry;
    }, []);

    let optionalEntities = entities
      .filter(entity => !required.includes(entity.entity))
      .map(entity => `"${entity.value}"^10`);

    let operator = (requiredEntities.length > 0) ? 'AND' : 'OR';
    let queryEntities = requiredEntities.concat(optionalEntities);
    queryEntities.push(`"${context.chatbotpersona}"^2`); // Persona
    let queryParams = {
      query: `classification:content ${operator} categoryLeaves:(${queryEntities.join(' ')} ${filterNodename})`,
      facetquery: [
        `categoryLeaves:("${output.nodes_visited[output.nodes_visited.length-1]}")`,  // Current Conversation Node
        '-locations:*', // Exclude location specific items
        `locale:"${context.outputlang || 'en'}"`
      ],
      fields: ['id', 'name', 'document:[json], score']
    };
    debug('queryParams %o', queryParams);
    wchDelivery.search
    .query(queryParams)
    .catch(reject)
    .then(cleanupAndShuffleResults)
    .catch(reject)
    .then(processAttachments)
    .catch(reject)
    .then(respSet => templating.parseJSON(watsonData, respSet))
    .catch(reject)
    .then(resolve);
  });
}

/**
 * In case a follow up action was defined fetch it from WCH.
 * @param  {Object} watsonData The response from the conversation service
 * @return {Promise}           When the promise resolves the enriched search result from WCH is returned.
 */
const processFollowUpResponse = function (watsonData) {
  return new Promise((resolve, reject) => {
    let { context, output, intents, entities, output: {required = []} } = watsonData;

    if (!output.action) {return resolve()};

    let queryEntities = [`"${context.chatbotpersona}"^30`, `+"${output.action}"`];

    let queryParams = {
      query: `classification:content AND categoryLeaves:(${queryEntities.join(' ')})`,
      facetquery: [
        `locale:"${context.outputlang || 'en'}"`
      ],
      fields: ['id', 'name', 'document:[json], score']
    };
    debug('follow up queryParams %o', queryParams);
    wchDelivery
      .search
      .query(queryParams)
      .catch(reject)
      .then(processAttachments)
      .catch(reject)
      .then(respSet => templating.parseJSON(watsonData, respSet))
      .catch(reject)
      .then(resolve);
  });
}

const processActionButton = function (attachmentButton) {
  return new Promise((resolve, reject) => {
    wchDelivery.send({
      baseUrl: wch.hosturl,
      uri: attachmentButton.url
    })
    .catch(reject)
    .then(attachmentResult => resolve(attachmentResult));
  });
}

const processAttachment = function (attachment) {
  return new Promise((resolve, reject) => {
    wchDelivery.send({
      baseUrl: wch.hosturl,
      uri: attachment.url
    })
    .catch(reject)
    .then(attachmentResult => {
      return new Promise((resolve, reject) => {
        if (attachmentResult.elements.quickreplies
          && attachmentResult.elements.quickreplies.values
          && attachmentResult.elements.quickreplies.values.length > 0) {
          let actionButtonPromises = attachmentResult.elements.quickreplies.values.map(processActionButton);

          Promise.all(actionButtonPromises)
          .catch(reject)
          .then(actionButtons => {
            debug('actionButtons %o', actionButtons);
            attachmentResult.elements.quickreplies.values = actionButtons;
            resolve(attachmentResult);
          });
        }
        else {
          resolve(attachmentResult);
        }
      });
    })
    .then(attachmentResult => resolve({id: attachmentResult.id, name: attachmentResult.name, document: attachmentResult}));
  });
}

const processAttachments = function (searchResult) {
  return new Promise((resolve, reject) => {
    let { numFound, documents } = searchResult;
    if ( numFound > 0
      && documents[0].document.elements.attachments
      && documents[0].document.elements.attachments.value === true) {
      let {attachmentquery: { value: filterQuery }, attachment: { values: attachments = {} } = {} } = documents[0].document.elements;
      debug('attachments %o', attachments)
      if (attachments.length > 0) {
        let attachmentsPromises = attachments.map(processAttachment);

        Promise.all(attachmentsPromises)
        .catch(reject)
        .then(attachments => {
          debug('attachments %o', attachments)
          let attachmentsResult = {numFound: attachments.length, documents: attachments};
          resolve({searchResult, attachmentsResult});
        });
      }
      else if (filterQuery) {
        let attachmentsQuery = {
          query: `classification:content AND type:ChatAttachment AND ${filterQuery}`,
          fields: ['id', 'name', 'document:[json]']
        }

        debug('attachmentsQuery %o', attachmentsQuery)
        wchDelivery.search
        .query(attachmentsQuery)
        .catch(reject)
        .then(attachmentsResult => {
          debug('attachmentsResult %o', attachmentsResult)
          resolve({searchResult, attachmentsResult});
        });
      }
      else {
        resolve({searchResult});
      }
    }
    else {
      resolve({searchResult});
    }
  });
}

/**
 * Public Class to get the best response for a current Watson Conversation Service state. Content is retrieved
 * trough a dynamic search against Watson Content Hub.
 */
class WchConversationV1 {
  constructor() {
    debug('WCH Response Caching Enabled: %b', wch.caching);
    this.wchResultSetCache = new NodeCache({stdTTL: 300}); // 5 Minutes of Caching...
    this.setCache = (wch.caching) ? (key, value) => this.wchResultSetCache.set(key, value) : () => true;
  };

  getWchConversationResponses(watsonData) {
    return new Promise((resolve, reject) => {
      let startTime = Date.now();

      generateMD5Key(watsonData)
        .then(hashKey => {
          debug('Hash %s', hashKey);
          let cachedResultSet = this.wchResultSetCache.get(hashKey);
          debug("cachedResultSet ", cachedResultSet);
          if (cachedResultSet) {
            let {conversationResp, locationResp, followupResp} = cachedResultSet;
            if (conversationResp && conversationResp.searchResult
              && conversationResp.searchResult.documents) {
              arrayutils.shuffle(conversationResp.searchResult.documents);
            }
            if (locationResp && locationResp.searchResult
              && locationResp.searchResult.documents) {
              arrayutils.shuffle(locationResp.searchResult.documents);
            }
            if (followupResp && followupResp.searchResult
              && followupResp.searchResult.documents) {
              arrayutils.shuffle(followupResp.searchResult.documents);
            }
            resolve(cachedResultSet);
            debug("WchConversationTime in ms: ", (Date.now()-startTime));
          }
          else {
            Promise.all([processLocationResponse(watsonData), processConversationResponse(watsonData), processFollowUpResponse(watsonData)])
            .catch(reject)
            .then(([locationResp, conversationResp, followupResp]) => {
              this.setCache(hashKey, {locationResp, conversationResp, followupResp});
              resolve({locationResp, conversationResp, followupResp});
              debug("WchConversationTime in ms: ", (Date.now()-startTime));
            });
          }
        })
        .catch(err => reject(err));
    });
  }

}

module.exports = new WchConversationV1();
