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
'use strict';

const debug = require('debug')('wchbotserver:sync');

const conversation = require('./conversation');
const wch = require('./wch').authoring;

function getWorkspace() {
  return new Promise((res, rej) => {
    conversation.getWorkspace({
      workspace_id: conversation.workspace_en,
      export: true
    }, 
    (err, resp) => {
      if(err) {
        debug(err);
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
        debug(err);
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
        debug(err);
        rej(err);
      }
      res(resp);
    });
  });
}

function transformToTaxonomy(workspace) {
  return new Promise((res, rej) => {
    try {
      let {intents, entities, dialog_nodes, metadata} = workspace;
      if(metadata === null) {
        metadata = {};
      }

      let taxonomies = {
        intents: [],
        entities: [],
        dialog_nodes: [],
        actions: []
      };
      taxonomies.intents.push({
        'parent': {name:'intents', id: metadata.wchintentid},
        'children': intents.map(obj => ({name: obj.intent, id: obj.description}))
      });

      taxonomies.entities.push({
        'parent': {name:'entities', id: metadata.wchentitiesid},
        'children': entities.map(obj => ({name: obj.entity, id: (obj.metadata)?obj.metadata.wchid:""}))
      });

      entities.forEach(entity => {
        taxonomies.entities.push({
          'parent': {name:entity.entity, id: (entity.metadata)?entity.metadata.wchid:""},
          'children': entity.values.map(obj => ({name: obj.value, id: (obj.metadata)?obj.metadata.wchid:""}))
        });
      });
      
      let nodesIdMap = new Map();
      let childParentMap = new Map();
      nodesIdMap.set('dialog_nodes', metadata.wchdialog_nodesid);
      let levelMap = new Map();

      dialog_nodes.forEach(({context = {}, parent, dialog_node } = {}) => {
        context = (context) ? context : {}; 
        let { wchid = undefined, nodename = undefined} = {} = context;
        let childname = (nodename) ? nodename : dialog_node;

        if(!parent || parent === null || parent === 'null') {
          parent = 'dialog_nodes';
        }

        if(wchid){
          nodesIdMap.set(childname, wchid);
        }

        let currChildren = levelMap.get(parent) || [];
        let newChildren = currChildren.concat([{name:childname, id: wchid}]);
        childParentMap.set(childname, parent);
        levelMap.set(parent, newChildren);
      });
     
      levelMap.forEach((childs, parent) => {

        let taxNode = { 
          'parent': {
            'name': parent,
            'id': nodesIdMap.get(parent)
          },
          'children': childs
        };

        taxonomies.dialog_nodes.push(taxNode);
      });
 
      function sortBy(data, transformFnct) {
        return data.map(ele => {
                  return {origin:ele, transf: transformFnct(ele)}
                })
                .sort((x, y) => x.transf - y.transf)
                .map(ele => ele.origin);
      }

      taxonomies.dialog_nodes = sortBy(taxonomies.dialog_nodes, node => {
        let counter = 0;
        let pointer = node.parent.name;
        while(pointer !== 'dialog_nodes') {
          counter++;
          pointer = childParentMap.get(pointer);
        }
        return counter;
      });


      taxonomies.actions.push({
        'parent': {name:'actions', id: metadata.wchdialog_actionid},
        'children': dialog_nodes.filter(obj => (obj.output && obj.output.action)).map(obj => ({name: obj.output.action, id: (obj.output.actionid)?obj.output.actionid:""}))
      });

      debug('taxonomies.dialog_nodes ', JSON.stringify(taxonomies.dialog_nodes, null, 1));

      res({workspace, taxonomies});
    } 
    catch (err) {
      debug(err);
      rej(err);
    }
  });
}

function cleanUpTaxonomies(values) {
  let {workspace, taxonomies} = values;
  return new Promise((res, rej) => {
    let taxNames = Object.keys(taxonomies);
    let searchQry = `name:${taxNames.join(' OR name:')}`
    wch.taxonomy.deleteTaxonomies(searchQry).
    catch(err => {debug('err', err); rej(err);}).
    then(() => res(values));
  });
}

function uploadTaxonomies(values) {
  let {workspace, taxonomies} = values;
  return new Promise((res, rej) => {
    wch.taxonomy.createTaxonomies(taxonomies).
    then(mapNameId => {
      let newMetadata = Object.assign({}, workspace.metadata, {
        wchintentid : mapNameId.intents.get('intents'),
        wchentitiesid : mapNameId.entities.get('entities'),
        wchdialog_nodesid : mapNameId.dialog_nodes.get('dialog_nodes')
      });

      workspace.metadata = newMetadata;

      workspace.intents.forEach(intent => {
        let wchid = mapNameId.intents.get(intent.intent);
        intent.description = wchid;
      }); 

      workspace.entities.forEach(entity => {
        let wchid = mapNameId.entities.get(entity.entity);
        let newMetaData = Object.assign({},
          entity.metadata,
          {wchid: wchid});
        entity.metadata = newMetaData;
        // Also set values...
        entity.values.forEach(value => {
           let wchid = mapNameId.entities.get(value.value);
           let newMetaData = Object.assign({},
           value.metadata,
              {wchid: wchid});
           value.metadata = newMetaData;
        });
      });

      workspace.dialog_nodes.forEach(node => {
        let wchid = mapNameId.dialog_nodes.get(node.dialog_node);
        let newContext = Object.assign({},
          node.context,
          {wchid: wchid});
        node.context = newContext;

        let actionid = mapNameId.actions.get(node.output.action);
        let newOutput = Object.assign({},
          node.output,
          {actionid: actionid});
        node.output = newOutput;
      });

      conversation.updateWorkspace (workspace,  
        (err, resp) => {
          if(err) {
            debug(err);
          }
          debug(resp);
          return values;
        }
      );

    }).
    catch(err => debug('ERROR ', err)).
    then(res);
  });
}

function updateTaxonomies(values) {
  let {workspace, taxonomies} = values;
  return new Promise((res, rej) => {
    wch.taxonomy.updateTaxonomies(taxonomies).
    catch(err => debug(err)).
    then(newTaxonomies => {
      debug("UPDATED ", newTaxonomies);


      let mapNameId = {
        intents: new Map(),
        entities: new Map(),
        dialog_nodes: new Map(),
        actions: new Map()
      }

      Object.keys(newTaxonomies).forEach(key => {
          newTaxonomies[key].forEach(intent => {
            mapNameId[key].set(intent.parent.name, intent.parent.id);
            intent.children.forEach(child => {
              mapNameId[key].set(child.name, child.id)
            });
          });
        });

      workspace.intents.forEach(intent => {
        if(!intent.description) {
          debug("new Intent", mapNameId.intents.get(intent.intent))
          intent.description = mapNameId.intents.get(intent.intent);
        }
      }); 

      workspace.entities.forEach(entity => {
        if(!entity.metadata || !entity.metadata.wchid) {
          let wchid = mapNameId.entities.get(entity.entity);
          let newMetaData = Object.assign({},
            entity.metadata,
            {wchid: wchid});
          entity.metadata = newMetaData;
          // Also set values...
          entity.values.forEach(value => {
             if(!value.metadata || !value.metadata.wchid) {
               let wchid = mapNameId.entities.get(value.value);
               let newMetaData = Object.assign({},
               value.metadata,
                  {wchid: wchid});
               value.metadata = newMetaData;
             }
          });
        }
      });

      workspace.dialog_nodes.forEach(node => {
        if(!node.context || !node.context.wchid) {
          let nodename = (node.context && node.context.nodename)?node.context.nodename:node.dialog_node;
          let wchid = mapNameId.dialog_nodes.get(nodename);
          let newContext = Object.assign({},
            node.context,
            {wchid: wchid});
          node.context = newContext;
        }

        if(node.output && node.output.action && !node.output.actionid) {
          let actionname = node.output.action;
          let actionid = mapNameId.actions.get(actionname);
          let newOutput = Object.assign({},
            node.output,
            {actionid: actionid});
          node.output = newOutput;
        }

      });

      conversation.updateWorkspace (workspace,  
        (err, resp) => {
          if(err) {
            debug(err);
          }
          debug(resp);
          return values;
        }
      );

    }).
    catch(err => debug('ERROR ', err)).
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
      return new Promise((res, rej) => {
        getWorkspace().
        catch(rej).
        then(transformToTaxonomy).
        catch(rej).
        then(updateTaxonomies).
        then(res);
      });
    }
  }

  sync() {

  }

}

module.exports = new SyncService();