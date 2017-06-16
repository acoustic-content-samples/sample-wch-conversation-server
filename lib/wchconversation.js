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
'use strict'

const debug = require('debug')('wchbotserver:wchconversation');

const wch = require('./wch').delivery;
const templating = require('./templating');

const NodeCache = require( "node-cache" );
const wchResultSetCache = new NodeCache({stdTTL:300}); // 5 Minutes of Caching...

const crypto = require('crypto');
const fs = require('fs');
const hash = crypto.createHash('md5');

function generateMD5Key(watsonData, hashType, digestEncoding) {
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
    let hash = crypto.createHash(_hashType).
      update(JSON.stringify(intents), 'utf8').
      update(JSON.stringify(entities), 'utf8').
      update(JSON.stringify(output), 'utf8').
      update(JSON.stringify(generalContext), 'utf8').
      digest(_encoding);
    resolve(hash);
  });
}

function WchConversationV1() {
  this.setCache = (wch.caching) ? (key, value) => wchResultSetCache.set(key, value) : () => true;
};

WchConversationV1.prototype.getWchConversationResponses = function (watsonData) {
  return new Promise((resolve, reject) => {
    let startTime = Date.now();
    
    generateMD5Key(watsonData).then(hashKey => {
      debug('Hash %s', hashKey);
      let cachedResultSet = wchResultSetCache.get(hashKey);
      debug("cachedResultSet ", cachedResultSet);
      if(cachedResultSet) {
        let {locationResp, conversationResp, followupResp} = cachedResultSet;

        if(conversationResp && conversationResp.searchResult
          && cachedResultSet.conversationResp.searchResult.documents) 
            shuffleArray(cachedResultSet.conversationResp.searchResult.documents);
        if(locationResp && locationResp.searchResult
          && cachedResultSet.locationResp.searchResult.documents) 
            shuffleArray(cachedResultSet.locationResp.searchResult.documents);
        if(followupResp && followupResp.searchResult
          && cachedResultSet.followupResp.searchResult.documents) 
             shuffleArray(cachedResultSet.followupResp.searchResult.documents);
        
        resolve(cachedResultSet);
        debug("WchConversationTime in ms: ", (Date.now()-startTime));
      } else {
        Promise.all([processLocationResponse(watsonData), processConversationResponse(watsonData), processFollowUpResponse(watsonData)]).
        catch(reject).
        then(([locationResp, conversationResp, followupResp]) => {
          debug("WchConversationTime in ms: ", (Date.now()-startTime));
          this.setCache(hashKey, {locationResp, conversationResp, followupResp});
          resolve({locationResp, conversationResp, followupResp});
        });
      }
    });

  });
}

function processLocationResponse (watsonData) {
  return new Promise((resolve, reject) => {
      let { context, output, intents, entities, context:{nodename}, output:{required = []} } = watsonData;

      if(!context.geolocation || !context.geolocation.lat || !context.geolocation.lng) {
        return resolve({searchResult:{numFound:0, documents:[]}});
      }

      let filterNodename =  (nodename)?`"${nodename}"^20`:'';

      let requiredEntities = required.reduce((resarry, reqEntitiy) => {
        let entiyValues = entities[reqEntitiy] || context[reqEntitiy]; 
        return (entiyValues) ? resarry.concat(entiyValues.map(entity => (`+"${entity.value}"`))) : resarry;
      }, []);

      let optionalEntities = entities.
        filter(entity => !required.includes(entity.entity)).
        map(entity => `"${entity.value}"^10`);

      let operator = (requiredEntities.length > 0)? 'AND' : 'OR';
      let queryEntities = requiredEntities.concat(optionalEntities);
      queryEntities.push(`"${context.chatbotpersona}"^30`); // Persona
      let queryParams = {
        query:`classification:content ${operator} categoryLeaves:(${queryEntities.join(' ')} ${filterNodename})`,
        facetquery: [
          `categoryLeaves:("${output.nodes_visited[output.nodes_visited.length-1]}")`  // Current Conversation Node
        ],
        spacialsearch: {
          position: context.geolocation,
          distance: 2,
          sort:'desc'
        },
        fields: ['id', 'name', 'document:[json], score']
      };
      debug('spatialQueryParams %o', queryParams);
      wch.search.query(queryParams).
      catch(reject).
      then(cleanupAndShuffleResults).
      catch(reject).
      then(searchResult => templating.parseJSON(watsonData, searchResult)).
      catch(reject).
      then(processAttachment).
      catch(reject).
      then(respSet => templating.parseJSON(watsonData, respSet)).
      catch(reject).
      then(resolve); 
  });
}

function processConversationResponse (watsonData) {
  return new Promise((resolve, reject) => {
      let { context, output, intents, entities, context:{nodename}, output:{required = []} } = watsonData;

      let filterNodename =  (nodename)?`"${nodename}"^20`:'';

      let requiredEntities = required.reduce((resarry, reqEntitiy) => {
        let entiyValues = entities[reqEntitiy] || context[reqEntitiy]; 
        return (entiyValues) ? resarry.concat(entiyValues.map(entity => (`+"${entity.value}"`))) : resarry;
      }, []);

      let optionalEntities = entities.
        filter(entity => !required.includes(entity.entity)).
        map(entity => `"${entity.value}"^10`);

      let operator = (requiredEntities.length > 0)? 'AND' : 'OR';
      let queryEntities = requiredEntities.concat(optionalEntities);
      queryEntities.push(`"${context.chatbotpersona}"^2`); // Persona
      let queryParams = {
        query:`classification:content ${operator} categoryLeaves:(${queryEntities.join(' ')} ${filterNodename})`,
        facetquery: [
          `categoryLeaves:("${output.nodes_visited[output.nodes_visited.length-1]}")`,  // Current Conversation Node
          '-locations:*' // Exclude location specific items
        ],
        fields: ['id', 'name', 'document:[json], score']
      };
      debug('queryParams %o', queryParams);
      wch.search.query(queryParams).
      catch(reject).
      then(cleanupAndShuffleResults).
      catch(reject).
      then(processAttachment).
      catch(reject).
      then(respSet => templating.parseJSON(watsonData, respSet)).
      catch(reject).
      then(resolve); 
  });
}

/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}


function cleanupAndShuffleResults(searchresult) {
  return new Promise((resolve, reject) => {
    let {numFound, documents} = searchresult;
    if(numFound > 1) {
      let highestScore = documents[0].score;
      let filtered = documents.filter(ele => ele.score === highestScore);
      shuffleArray(filtered);
      searchresult.documents = filtered;
    } 
    resolve(searchresult);
  });
}

function processFollowUpResponse (watsonData) {
  return new Promise((resolve, reject) => {
      let { context, output, intents, entities , output:{required = []} } = watsonData;

      if(!output.action) {return resolve()};

      let queryEntities = [`"${context.chatbotpersona}"^30`, `+"${output.action}"`];

      let queryParams = {
        query:`classification:content AND categoryLeaves:(${queryEntities.join(' ')})`,
        fields: ['id', 'name', 'document:[json], score']
      };
      debug('follow up queryParams %o', queryParams);
      wch.search.query(queryParams).
      catch(reject).
      then(processAttachment).
      catch(reject).
      then(respSet => templating.parseJSON(watsonData, respSet)).
      catch(reject).
      then(resolve); 
  });
}

function processAttachment (searchResult) {
  return new Promise((resolve, reject) => {
    let { numFound, documents } = searchResult;

    if ( numFound > 0 
      && documents[0].document.elements.attachments 
      && documents[0].document.elements.attachments.value === true) 
    {

      let {attachmentquery : { value : filterQuery }, attachment : { value: {url: attachmentUrl } = {} } = {} } = documents[0].document.elements;
      if(attachmentUrl) {
        
        wch.send({
          baseUrl: "https://my6.digitalexperience.ibm.com",
          uri: attachmentUrl
        }).
        then(attachment => {
          debug('attachment %o', attachment)
          let attachmentsResult = {numFound:1, documents:[{document:attachment}]};
          resolve({searchResult, attachmentsResult});
        });
      } else if (filterQuery) {

        let attachmentsQuery = {
          query:`classification:content AND type:Attachment AND ${filterQuery}`,
          fields: ['id', 'name', 'document:[json]']
        }
        
        // debug('attachmentsQuery ', attachmentsQuery)
        wch.search.query(attachmentsQuery).
        catch(reject).
        then(attachmentsResult => {
          // debug('attachmentsResult ', attachmentsResult)
          resolve({searchResult, attachmentsResult});
        }); 
      }
    } else {
      resolve({searchResult});
    }
  });
}

module.exports = new WchConversationV1();