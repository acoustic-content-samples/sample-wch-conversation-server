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

const conversation = require('./conversation');
const wch = require('./wch').authoring;

const demoWorkspace_en = 'bba2bb71-5b1d-482c-bee9-db752c8c46a9';

function getWorkspace() {
  return new Promise((res, rej) => {
    conversation.getWorkspace({
      workspace_id: demoWorkspace_en,
      export: true
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

function getIntents() {
  return new Promise((res, rej) => {
    conversation.getIntents({
      workspace_id: demoWorkspace_en,
      export: true
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

function getEntities() {
  return new Promise((res, rej) => {
    conversation.getEntities({
      workspace_id: demoWorkspace_en,
      export: true
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

function transformToTaxonomy(workspace) {
  return new Promise((res, rej) => {
    let intentsObjs = workspace.intents;
    let entitiesObj = workspace.entities;
    let nodesObj = workspace.dialog_nodes

    let taxonomies = [];

    taxonomies.push({
      'name': 'intents',
      'childs': intentsObjs.map(obj => obj.intent)
    });

    taxonomies.push({
      'name': 'nodes',
      'childs': nodesObj.map(obj => obj.dialog_node)
    });

    entitiesObj.forEach(entity => {
      taxonomies.push({
        'name': entity.entity,
        'childs': entity.values.map(value => value.value)
      });

      entity.values.forEach(value => {
        if(value.synonyms) {
          taxonomies.push({
            'parent': value.value,
            'childs': value.synonyms
          });
        }
      });

    });

    res({workspace, taxonomies});

  });
}

function cleanUpTaxonomies(values) {
  let {workspace, taxonomies} = values;
  return new Promise((res, rej) => {
    let searchqry='';
    taxonomies.forEach(value => {
      if(value.name) {
        searchqry+=`name:${value.name} OR `
      }
    });
    wch.taxonomy.deleteTaxonomies(searchqry.substring(0, searchqry.length-4)).
    catch(err => {console.log('err', err); rej(err);}).
    then(() => res(values));
  });
}

function uploadTaxonomies(values) {
  let {workspace, taxonomies} = values;
  return new Promise((res, rej) => {
    wch.taxonomy.createTaxonomies(taxonomies).
    then(mapNameId => {
     
      workspace.intents.forEach(intent => {
        let wchid = mapNameId.get(intent.intent);
        intent.description = wchid;
      }); 

      workspace.entities.forEach(entity => {
        let wchid = mapNameId.get(entity.entity);
        let newMetaData = Object.assign({},
          entity.metadata,
          {wchid: wchid});
        entity.metadata = newMetaData;
        // Also set values...
        entity.values.forEach(value => {
           let wchid = mapNameId.get(value.value);
           let newMetaData = Object.assign({},
           value.metadata,
              {wchid: wchid});
           value.metadata = newMetaData;
        });
      });

      workspace.dialog_nodes.forEach(node => {
        let wchid = mapNameId.get(node.dialog_node);
        let newContext = Object.assign({},
          node.context,
          {wchid: wchid});
        node.context = newContext;
      });

      conversation.updateWorkspace (workspace,  
        (err, resp) => {
          if(err) {
            console.log(err);
          }
          console.log(resp);
          return values;
        }
      );

    }).
    catch(err => console.log('ERROR ', err)).
    then(res);
  });
}

class SyncService {
  constructor() {

  }

  get WCH () {return "WCH";}
  get WCS () {return "WCS";}

  init(options) {
    let {fromSys, toSys} = options;
    if(fromSys === this.WCS && toSys === this.WCH) {
      return new Promise((res, rej) => {
        getWorkspace().
        catch(rej).
        then(transformToTaxonomy).
        catch(rej).
        then(cleanUpTaxonomies).
        catch(rej).
        then(uploadTaxonomies).
        catch(rej).
        then(res);
      });
    }
  }

  /**
   * [push description]
   * @return {[type]} [description]
   *
   * {
   *   from: '',
   *   to: ''
   * }
   */
  push(options) {
    let {fromSys, toSys} = options;
    if(fromSys === this.WCS && toSys === this.WCH) {
      // return new Promise((res, rej) => {
      //   getWorkspace().
      //   catch(rej).
      //   then(transformToTaxonomy).
      //   catch(rej).
      //   then(prepareTaxonomies).
      //   catch(rej).
      //   then(updateTaxonomies).
      //   catch(rej).
      //   then(res);
      // });
    }
  }

  sync() {

  }

}

module.exports = new SyncService();