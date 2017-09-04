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

const wch = require('./services/wch');
const wchDelivery = require('./services/wch').delivery;
const templating = require('./templating');

const NodeCache = require('node-cache');
const wchResultSetCache = new NodeCache({stdTTL: 300}); // 5 Minutes of Caching...

const crypto = require('crypto');
const fs = require('fs');
const hash = crypto.createHash('md5');

const generateMD5Key = (watsonData, hashType, digestEncoding) => {
  let {intents, entities, output, context} = watsonData;
  let generalContext = {
    clienttype: context.clienttype,
    wchid: context.wchid,
    gotfunky: context.gotfunky,
    username: context.username,
    chatbotpersona: context.chatbotpersona,
    askedContactDetails: context.askedContactDetails,
    lastIntent: context.lastIntent,
    nodename: context.nodename
  };

  let data = JSON.stringify(watsonData, null, 1);
  let _encoding = digestEncoding || 'base64';
  let _hashType = (crypto.getHashes().indexOf(hashType) > -1) ? hashType : 'md5';

  return new Promise((resolve, reject) => {
    let hash = crypto.createHash(_hashType)
      .update(JSON.stringify({
        intents,
        entities,
        output,
        generalContext
      }), 'utf8')
    .digest(_encoding);
    resolve(hash);
  })
  .catch(err => reject(err));
}

/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
const shuffleArray = function (array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

const cleanupAndShuffleResults = function (searchresult) {
  return new Promise((resolve, reject) => {
    let {numFound, documents} = searchresult;
    if (numFound > 1) {
      // The highest store is the first element
      let highestScore = documents[0].score;
      let filtered = documents.filter(ele => ele.score === highestScore);
      if (filtered.length === numFound) {
        // All elements have the same score - hence no optional classifiers matched.
        // Filter for content item with the smallest amount of filter categories
        // since that's the most unspecific one...
        let minCount = 9999999;
        filtered = filtered.map(ele => {
          let { document: { elements: { filter } } } = ele;
          let length = (filter && filter.categories) ? filter.categories.length : 0;
          if (length < minCount) {
            minCount = length;
          }
          return {origin: ele, transf: length};
        })
        .filter(x => x.transf === minCount)
        .map(ele => ele.origin);
      }
      debug('Filtered list %o', filtered);
      shuffleArray(filtered);
      searchresult.documents = filtered;
    }
    resolve(searchresult);
  });
}

const processLocationResponse = function (watsonData) {
  return new Promise((resolve, reject) => {
    let { context, output, intents, entities, context: {nodename}, output: {required = []} } = watsonData;

    if (!context.geolocation || !context.geolocation.lat || !context.geolocation.lng) {
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
        distance: 2,
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

const processConversationResponse = function (watsonData) {
  return new Promise((resolve, reject) => {
    let { context, output, intents, entities, context: {nodename}, output: {required = []} } = watsonData;

    let filterNodename =  (nodename)?`"${nodename}"^20`:'';
    debug('Required entities %o', required);
    let requiredEntities = required.reduce((resarry, reqEntitiy) => {
      let entityValues = entities[reqEntitiy] || context[reqEntitiy];
      debug('Required entities for entitiy %s %o', reqEntitiy, entityValues);
      return (entityValues) ? resarry.concat(entityValues.map(entity => (`+"${entity.value}"`))) : resarry;
    }, []);

    let optionalEntities = entities
      .filter(entity => !required.includes(entity.entity))
      .map(entity => `"${entity.value}"^10`);

    let operator = (requiredEntities.length > 0)? 'AND' : 'OR';
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

class WchConversationV1 {
  constructor() {
    debug('WCH Resonse Caching Enabled: %b', wch.caching);
    this.setCache = (wch.caching) ? (key, value) => wchResultSetCache.set(key, value) : () => true;
  };

  getWchConversationResponses(watsonData) {
    return new Promise((resolve, reject) => {
      let startTime = Date.now();

      generateMD5Key(watsonData)
        .then(hashKey => {
          debug('Hash %s', hashKey);
          let cachedResultSet = wchResultSetCache.get(hashKey);
          debug("cachedResultSet ", cachedResultSet);
          if (cachedResultSet) {
            let {locationResp, conversationResp, followupResp} = cachedResultSet;

            if (conversationResp && conversationResp.searchResult
              && cachedResultSet.conversationResp.searchResult.documents) {
              shuffleArray(cachedResultSet.conversationResp.searchResult.documents);
            }
            if (locationResp && locationResp.searchResult
              && cachedResultSet.locationResp.searchResult.documents) {
              shuffleArray(cachedResultSet.locationResp.searchResult.documents);
            }
            if (followupResp && followupResp.searchResult
              && cachedResultSet.followupResp.searchResult.documents) {
              shuffleArray(cachedResultSet.followupResp.searchResult.documents);
            }
            resolve(cachedResultSet);
            debug("WchConversationTime in ms: ", (Date.now()-startTime));
          }
          else {
            Promise.all([processLocationResponse(watsonData), processConversationResponse(watsonData), processFollowUpResponse(watsonData)])
            .catch(reject)
            .then(([locationResp, conversationResp, followupResp]) => {
              debug("WchConversationTime in ms: ", (Date.now()-startTime));
              this.setCache(hashKey, {locationResp, conversationResp, followupResp});
              resolve({locationResp, conversationResp, followupResp});
            });
          }
        })
        .catch(err => reject(err));
    });
  }

}

module.exports = new WchConversationV1();
