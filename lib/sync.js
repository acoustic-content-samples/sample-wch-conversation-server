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

function transformToTaxonomy(values) {
  return new Promise((res, rej) => {
    let intentsObjs = values[0];
    let entitiesObj = values[1];

    let taxonomies = [];

    taxonomies.push({
      'name': 'intents',
      'childs': intentsObjs.intents.map(obj => obj.intent)
    });
    entitiesObj.entities.forEach(entity => {
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

    res(taxonomies);

  });
}

function cleanUpTaxonomies(values) {
  return new Promise((res, rej) => {
    let searchqry='';
    values.forEach(value => {
      if(value.name) {
        searchqry+=`name:${value.name} OR `
      }
    });

    wch.deleteTaxonomies(searchqry.substring(0, searchqry.length-4)).
    then(() => res(values));
  });
}

function uploadTaxonomies(taxonomiesDef) {
  return new Promise((res, rej) => {
    wch.createTaxonomies(taxonomiesDef).
    then(res);
  });
}

class SyncService {
  constructor() {

  }

  get WCH () {return "WCH";}
  get WCS () {return "WCS";}

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
    return new Promise((res, rej) => {
      Promise.all([getIntents(), getEntities()]).
      then(transformToTaxonomy).
      then(cleanUpTaxonomies).
      then(uploadTaxonomies).
      then(res);
    });
  }

  sync() {

  }

}

module.exports = new SyncService();