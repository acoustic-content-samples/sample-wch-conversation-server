const wch = require('./wch').delivery;

function WchConversationV1() {

};

WchConversationV1.prototype.getWchConversationResponses = function (watsonData) {
  return new Promise((resolve, reject) => {
    Promise.all([processConversationResponse(watsonData), processFollowUpResponse(watsonData)]).
    catch(reject).
    then(results => {
      let [conversationResp, followupResp] = results;
      resolve({conversationResp, followupResp});
    });
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
      queryEntities.push(`"${context.chatbotpersona}"^30`); // Persona
      let queryParams = {
        query:`classification:content ${operator} categoryLeaves:(${queryEntities.join(' ')} ${filterNodename})`,
        facetquery: [
          `categoryLeaves:("${output.nodes_visited[output.nodes_visited.length-1]}")`,  // Current Conversation Node
          '-locations:*'
        ],
        fields: ['id', 'name', 'document:[json], score']
      };
      console.log('queryParams ', queryParams);
      wch.search.query(queryParams).
      catch(reject).
      then(cleanupAndShuffleResults).
      catch(reject).
      then(processAttachment).
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
      console.log('queryParams ', queryParams);
      wch.search.query(queryParams).
      catch(reject).
      then(processAttachment).
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
      let filterQuery = documents[0].document.elements.attachmentquery.value;

      let attachmentsQuery = {
        query:`classification:content AND type:Attachment AND ${filterQuery}`,
        fields: ['id', 'name', 'document:[json]']
      }
      
      console.log('attachmentsQuery ', attachmentsQuery)
      wch.search.query(attachmentsQuery).
      catch(reject).
      then(attachmentsResult => {
        console.log('attachmentsResult ', attachmentsResult)
        resolve({searchResult, attachmentsResult});
      });
    } else {
      resolve({searchResult});
    }
  });
}

module.exports = new WchConversationV1();