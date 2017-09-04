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

const debug = require('debug')('wchbotserver:sync');

const conversation = require('./services/conversation');
const wch = require('./services/wch').authoring;

const getWorkspace = function () {
  debug('Retrieving workspace');
  return new Promise((res, rej) => {
    conversation.getWorkspace({
      workspace_id: conversation.workspace_en, // eslint-disable-line camelcase
      export: true
    },
    (err, resp) => {
      if (err) {
        debug('An error occured retrieving the workspace %o', err);
        rej(err);
      }
      debug('Retrieved workspace');
      res(resp);
    });
  });
}

const getIntents = function () {
  debug('Retrieving intents');
  return new Promise((res, rej) => {
    conversation.getIntents({
      workspace_id: demoWorkspace_en, // eslint-disable-line camelcase
      export: true
    },
    (err, resp) => {
      if (err) {
        debug(err);
        rej(err);
      }
      debug('Retrieved intents');
      res(resp);
    });
  });
}

const getEntities = function () {
  debug('Retrieving entities');
  return new Promise((res, rej) => {
    conversation.getEntities({
      workspace_id: demoWorkspace_en, // eslint-disable-line camelcase
      export: true
    },
    (err, resp) => {
      if (err) {
        debug('An error occured retrieving the entities ', err);
        rej(err);
      }
      debug('Retrieved entities');
      res(resp);
    });
  });
}

const transformToTaxonomy = function (workspace) {
  debug('Transform Workspace to Taxonomy');
  return new Promise((res, rej) => {
    try {
      let {intents, entities, dialog_nodes, metadata} = workspace; // eslint-disable-line camelcase
      if (metadata === null) {
        metadata = {};
      }

      let taxonomies = {
        intents: [],
        entities: [],
        dialog_nodes: [], // eslint-disable-line camelcase
        actions: []
      };
      taxonomies.intents.push({
        'parent': {name: 'intents', id: metadata.wchintentid},
        'children': intents.map(obj => ({name: obj.intent, id: obj.description}))
      });

      taxonomies.entities.push({
        'parent': {name: 'entities', id: metadata.wchentitiesid},
        'children': entities.map(obj => ({name: obj.entity, id: (obj.metadata)?obj.metadata.wchid:""}))
      });

      entities.forEach(entity => {
        taxonomies.entities.push({
          'parent': {name: entity.entity, id: (entity.metadata)?entity.metadata.wchid:""},
          'children': entity.values.map(obj => ({name: obj.value, id: (obj.metadata)?obj.metadata.wchid:""}))
        });
      });

      let nodesIdMap = new Map();
      let childParentMap = new Map();
      nodesIdMap.set('dialog_nodes', metadata.wchdialog_nodesid);
      let levelMap = new Map();

      dialog_nodes.forEach(node => {
        if (node.title !== null && node.title !== undefined && node.title !== node.dialog_node) {
          dialog_nodes.forEach(siblingNode => {
            if (siblingNode.parent === node.dialog_node) {
              siblingNode.parent = node.title;
            }
            if (siblingNode.previous_sibling === node.dialog_node) {
              debug('previous sibling');
              siblingNode.previous_sibling = node.title;
            }
            if (siblingNode.next_step && siblingNode.next_step.dialog_node === node.dialog_node) {
              debug('next step');
              siblingNode.next_step.dialog_node = node.title;
            }
          });
          node.dialog_node = node.title;
        }
      });

      dialog_nodes.forEach(({context = {}, parent, dialog_node, title } = {}) => { // eslint-disable-line camelcase
        context = (context) ? context : {};
        let { wchid = undefined, nodename = undefined} = {} = context;
        let childname = (nodename) ? nodename : dialog_node; // eslint-disable-line camelcase
        debug('Childname ', childname);

        if (!parent || parent === null || parent === 'null') {
          parent = 'dialog_nodes';
        }

        if (wchid){
          nodesIdMap.set(childname, wchid);
        }

        let currChildren = levelMap.get(parent) || [];
        let newChildren = currChildren.concat([{name: title || childname, id: wchid}]);
        childParentMap.set(childname, parent);
        debug('parent ', parent);
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

      let sortBy = function (data, transformFnct) {
        return data.map(ele => {
          return {origin: ele, transf: transformFnct(ele)}
        })
        .sort((x, y) => x.transf - y.transf)
        .map(ele => ele.origin);
      }

      taxonomies.dialog_nodes = sortBy(taxonomies.dialog_nodes, node => { // eslint-disable-line camelcase
        let counter = 0;
        debug('node.parent.name ', node.parent.name);
        let pointer = node.parent.name;
        while (pointer !== 'dialog_nodes') {
          counter++;
          if(childParentMap.get(pointer) === undefined) {
            debug('childParentMap somethings wrong', childParentMap.get(pointer));
            return rej('Pointer error');
          } else {
            debug('New Pointer %s', childParentMap.get(pointer));
            pointer = childParentMap.get(pointer);
          }
        }
        return counter;
      });


      taxonomies.actions.push({
        'parent': {name: 'actions', id: metadata.wchdialog_actionid},
        'children': dialog_nodes.filter(obj => (obj.output && obj.output.action)).map(obj => ({name: obj.output.action, id: (obj.output.actionid)?obj.output.actionid:""})) // eslint-disable-line camelcase
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

const cleanUpTaxonomies = function (values) {
  let {workspace, taxonomies} = values;
  return new Promise((res, rej) => {
    let taxNames = Object.keys(taxonomies);
    let searchQry = `name:${taxNames.join(' OR name:')}`
    wch.taxonomy.deleteTaxonomies(searchQry)
    .catch(err => {debug('err', err); rej(err);})
    .then(() => res(values));
  });
}

const uploadTaxonomies = function (values) {
  let {workspace, taxonomies} = values;
  return new Promise((res, rej) => {
    wch.taxonomy.createTaxonomies(taxonomies)
    .then(mapNameId => {
      let newMetadata = Object.assign({}, workspace.metadata, {
        wchintentid: mapNameId.intents.get('intents'),
        wchentitiesid: mapNameId.entities.get('entities'),
        wchdialog_nodesid: mapNameId.dialog_nodes.get('dialog_nodes') // eslint-disable-line camelcase
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
          if (err) {
            debug(err);
          }
          debug(resp);
          return values;
        }
      );
    })
    .catch(err => debug('ERROR ', err))
    .then(res);
  });
}

const updateTaxonomies = function (values) {
  let {workspace, taxonomies} = values;
  return new Promise((res, rej) => {
    wch.taxonomy.updateTaxonomies(taxonomies)
    .catch(err => debug(err))
    .then(newTaxonomies => {
      debug("Update Taxonomy: %o ", newTaxonomies);

      let mapNameId = {
        intents: new Map(),
        entities: new Map(),
        dialog_nodes: new Map(), // eslint-disable-line camelcase
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
        debug('Intent %o', intent);
        let intentId = mapNameId.intents.get(intent.intent);
        if (intentId) {
          intent.description = intentId;
        }
      });

      workspace.entities.forEach(entity => {
        let {entity : name, metadata} = entity;
        let wchid = mapNameId.entities.get(name);
        debug('Entity: %s Old ID: %s New Wch ID: %s', name, (metadata) ? metadata.wchid : 'None', wchid);
        if (wchid) {
          let newMetaData = Object.assign({},
            entity.metadata,
            {wchid: wchid});
          entity.metadata = newMetaData;

        }

        // Also set values...
        entity.values.forEach(value => {
          let {value : name, metadata} = value;
          let wchid = mapNameId.entities.get(name);
          debug('Synonym: %s Old ID: %s New Wch ID: %s', name, (metadata) ? metadata.wchid : 'None', wchid);
          if (wchid) {
            let newMetaData = Object.assign({},
            value.metadata,
              {wchid: wchid});
            value.metadata = newMetaData;
          }
        });

      });

      workspace.dialog_nodes.forEach(node => {
        let nodename = (node.context && node.context.nodename) ? node.context.nodename : (node.title || node.dialog_node);
        let wchid = mapNameId.dialog_nodes.get(nodename);
        if (wchid) {
          let newContext = Object.assign({},
            node.context,
            {wchid: wchid});
          node.context = newContext;
        }

        let actionname = node.output.action;
        let actionid = mapNameId.actions.get(actionname);
        if (actionid) {
          let newOutput = Object.assign({},
            node.output,
            {actionid: actionid});
          node.output = newOutput;
        }

        // update dialog_node id
        if(node.title !== null && node.title !== undefined && node.title !== node.dialog_node) {
          debug('NODE TITLE ', node.title);
          workspace.dialog_nodes.forEach(siblingNode => {
            if(siblingNode.parent === node.dialog_node) {
              siblingNode.parent = node.title;
            }
            if(siblingNode.previous_sibling === node.dialog_node) {
              debug('previous sibling');
              siblingNode.previous_sibling = node.title;
            }
            if(siblingNode.next_step && siblingNode.next_step.dialog_node === node.dialog_node) {
              debug('next step');
              siblingNode.next_step.dialog_node = node.title;
            }
          });
          node.dialog_node = node.title;
        }
      });

      debug('%o', JSON.stringify(workspace));
      conversation.updateWorkspace (workspace,
        (err, resp) => {
          if (err) {
            debug('An Error occured while updating the WCS Workspace %o', err);
          }
          debug(resp);
          return values;
        }
      );
    })
    .catch(err => debug('ERROR ', err))
    .then(res);
  });
}

class SyncService {
  constructor() {}

  get WCH () {return "WCH";}
  get WCS () {return "WCS";}

  init(options) {
    let {fromSys, toSys} = options;
    if (fromSys === this.WCS && toSys === this.WCH) {
      return new Promise((res, rej) => {
        getWorkspace()
        .catch(rej)
        .then(transformToTaxonomy)
        .catch(rej)
        .then(cleanUpTaxonomies)
        .catch(rej)
        .then(uploadTaxonomies)
        .catch(rej)
        .then(res);
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
    debug('Start Push. Options: %o', options);
    let {fromSys, toSys} = options;
    if (fromSys === this.WCS && toSys === this.WCH) {
      return new Promise((res, rej) => {
        getWorkspace()
        .catch(rej)
        .then(transformToTaxonomy)
        .catch(rej)
        .then(updateTaxonomies)
        .then(res);
      });
    }
  }

  sync() {

  }

}

module.exports = new SyncService();
