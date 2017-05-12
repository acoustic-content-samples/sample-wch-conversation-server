const wch = require('./wch').delivery;

function WchConversationV1() {

};

WchConversationV1.prototype.getWchConversationResponses = function (watsonData) {
  return new Promise((resolve, reject) => {
    Promise.all([processConversationResponse(watsonData), processFollowUpResponse(watsonData)]).
    then(results => {
      let [conversationResp, followupResp] = results;
      resolve({conversationResp, followupResp});
    });
  });
}

function processConversationResponse (watsonData) {
  return new Promise((resolve, reject) => {
      let { context, output, intents, entities , output:{required = []} } = watsonData;

      let requiredEntities = required.reduce((resarry, reqEntitiy) => {
        return resarry.concat(context[reqEntitiy].map(entity => (`+"${entity.value}"`)));
      }, []);

      let optionalEntities = entities.
        filter(entity => !required.includes(entity.entity)).
        map(entity => `"${entity.value}"^10`);

      let operator = (requiredEntities.length > 0)? 'AND' : 'OR';
      let queryEntities = requiredEntities.concat(optionalEntities);
      queryEntities.push(`"${context.chatbotpersona}"^30`); // Persona
      let queryParams = {
        query:`classification:content ${operator} categoryLeaves:('${queryEntities.join(' ')})`,
        facetquery: [
          `categoryLeaves:"${output.nodes_visited[output.nodes_visited.length-1]}"`  // Current Conversation Node
        ],
        fields: ['id', 'name', 'document:[json], score']
      };
      
      wch.search.query(queryParams).
      catch(reject).
      then(processAttachment).
      catch(reject).
      // then(result => Object.assign({},watsonData, result)).
      // catch(reject).
      then(resolve); 
  });
}

function processFollowUpResponse (watsonData) {
  return new Promise((resolve, reject) => {
      let { context, output, intents, entities , output:{required = []} } = watsonData;

      if(!output.action) resolve();

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
      // then(result => Object.assign({},watsonData, result)).
      // catch(reject).
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
      
      wch.search.query(attachmentsQuery).
      catch(reject).
      then(attachmentsResult => {
        resolve({searchResult, attachmentsResult});
      });
    } else {
      resolve({searchResult});
    }
  });
}

module.exports = new WchConversationV1();