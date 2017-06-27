#!/usr/bin/env node
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

/** Node Based Setup Script */

const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;

const cfenv = require('cfenv');
const dch_vcap_local = require('./dch_vcap');
const dch_vcap_new = require('./dch_vcap_sample');
const app_settings_new = require('./app_settings');

// Load the local credentials file
const env = cfenv.getAppEnv({
  vcap: {
    services: dch_vcap_local
  }
});

console.log(`Environment: ${(env.isLocal) ? "local" : "bluemix"}`);

const isSetExp = /^(?!<).*(?!>)$/;

const errLogger = err => {console.log('Something fishy happened :('); console.log('Error: ', err)};

const program = require('commander');
const prompt = require('prompt');
 
program
  .version('0.1.0')
  .option('-S, --sample-setup', 'Trigger sample creation after credentials setup');

program.on('--help', function(){
  console.log('  Examples:');
  console.log('');
  console.log('    $ node ./setup.js -h');
  console.log('    $ node ./setup.js init');
  console.log('');
});

//////////////////////////////
// Setup Credentials for Local Development or Sample Setup
//////////////////////////////

function checkPredefinedServices() {
  return new Promise((resolve, reject) => {
    let predefined = {};
    let tone_analyzer = env.services['tone_analyzer'];
    if(tone_analyzer){
      let { url = '<>', username = '<>', password = '<>'} = tone_analyzer[0].credentials;
      predefined.tone_analyzer = isSetExp.test(url) && isSetExp.test(username) && isSetExp.test(password);
    } else {
      predefined.tone_analyzer = false;
    }

    let conversation = env.services['conversation'];
    if(conversation){
      let { url = '<>', username = '<>', password = '<>'} = conversation[0].credentials;
      predefined.conversation = Object.assign({}, {
        url: isSetExp.test(url),
        username: isSetExp.test(username),
        password: isSetExp.test(password)
      });
    } else {
      predefined.conversation = { url: false, username: false, password: false };
    }

    if(env.services['user-provided']) {
      let [ wch_config, bot_config, geo_config ] = env.services['user-provided'];

      if(wch_config){
        let { baseurl = '<>', hosturl = '<>', tenantid = '<>', username = '<>', password = '<>'} = wch_config.credentials;
        predefined.wch = Object.assign({}, {
          baseurl: isSetExp.test(baseurl),
          hosturl: isSetExp.test(hosturl),
          tenatnid: isSetExp.test(tenantid),
          username: isSetExp.test(username),
          password: isSetExp.test(password)
        });
      } else {
        predefined.wch = { baseurl: false, hosturl: false, tenatnid: false, username: false, password: false };
      }

      if(bot_config){
        let { clientid = '<>', clientsecret = '<>', verificationtoken = '<>'} = bot_config.credentials;
        predefined.bot = Object.assign({}, {
          clientid: isSetExp.test(clientid),
          clientsecret: isSetExp.test(clientsecret),
          verificationtoken: isSetExp.test(verificationtoken)
        });
      } else {
        predefined.bot = { clientid: false, clientsecret: false, verificationtoken: false };
      }

      if(geo_config){
        let { key = '<>'} = geo_config.credentials;
        predefined.geo = isSetExp.test(key);
      } else {
        predefined.geo = false;
      }

    } else {
      predefined.wch = { baseurl: false, hosturl: false, tenatnid: false, username: false, password: false };
      predefined.geo = false;
      predefined.bot = { clientid: false, clientsecret: false, verificationtoken: false };
    }

    resolve(predefined);
  });
}

function initServices(predefined) {
  return new Promise((resolve, reject) => {
    let vcap = dch_vcap_new;
    setupToneAnalyzer({predefined, vcap}).
    then(setupConversationService).
    then(setupWCH).
    then(setupBot).
    then(setupGeo).
    then(({predefined, vcap}) => resolve(vcap));

  });
}
 
function setupToneAnalyzer({predefined, vcap}) {
  return new Promise((resolve, reject) => {
    console.log(
`############################
  Setup Tone Analyzer
############################`);
    console.log('Please provide the following parameters:');

    let schema = {
      properties: {
        url: {
          required: true
        },
        username: {
          required: true
        },
        password: {
          hidden: true,
          required: true
        }
      }
    };

    prompt.start();
    prompt.message = 'ToneAnalyzer';
    prompt.get(schema, function (err, result) {
      vcap.tone_analyzer[0].credentials.url = result.url;
      vcap.tone_analyzer[0].credentials.username = result.username;
      vcap.tone_analyzer[0].credentials.password = result.password;
      resolve({predefined, vcap});
    });

  });
}

function setupConversationService({predefined, vcap}) {
  return new Promise((resolve, reject) => {
console.log(
`############################
  Setup Conversation Service
############################`);
console.log('Please provide the following parameters:');

    let schema = {
      properties: {
        url: {
          required: true
        },
        username: {
          required: true
        },
        password: {
          hidden: true,
          required: true
        }
      }
    };
    prompt.message = 'Conversation';
    prompt.get(schema, function (err, result) {
      vcap.conversation[0].credentials.url = result.url;
      vcap.conversation[0].credentials.username = result.username;
      vcap.conversation[0].credentials.password = result.password;
      resolve({predefined, vcap});
    });

  });

}

function setupWCH({predefined, vcap}) {
  return new Promise((resolve, reject) => {
console.log(
`############################
  Setup Watson Content Hub
############################`);
console.log('Please provide the following parameters:');

    let schema = {
      properties: {
        baseurl: {
          required: true
        },
        hosturl: {
          required: true
        },
        tenantid: {
          required: true
        },
        username: {
          required: true
        },
        password: {
          hidden: true,
          required: true
        }
      }
    };

    prompt.message = 'WCH';
    prompt.get(schema, function (err, result) {
      vcap['user-provided'][0].credentials.baseurl = result.baseurl;
      vcap['user-provided'][0].credentials.hosturl = result.hosturl;
      vcap['user-provided'][0].credentials.tenantid = result.tenantid;
      vcap['user-provided'][0].credentials.username = result.username;
      vcap['user-provided'][0].credentials.password = result.password;
      resolve({predefined, vcap});
    });

  });
}

function setupBot({predefined, vcap}) {
  return new Promise((resolve, reject) => {
  console.log(
`############################
  Setup Bot
############################`);
  console.log('Please provide the following parameters:');

    let schema = {
      properties: {
        clientid: {
          required: true
        },
        clientsecret: {
          hidden: true,
          required: true
        },
        verificationtoken: {
        },
        redirectUri: {
        },
        profcontent: {
          required: false
        }
      }
    };
    
    prompt.message = 'Bot';
    prompt.get(schema, function (err, result) {
      vcap['user-provided'][1].credentials.clientid = result.clientid;
      vcap['user-provided'][1].credentials.clientsecret = result.clientsecret;
      vcap['user-provided'][1].credentials.verificationtoken = result.verificationtoken;
      if(result.profcontent) vcap['user-provided'][1].credentials.profcontent = result.profcontent;
      resolve({predefined, vcap});
    });

  });
}

function setupGeo({predefined, vcap}) {
return new Promise((resolve, reject) => {
  console.log(
`############################
  Setup Geolocation
############################`);
  console.log('Please provide the following parameters:');

    let schema = {
      properties: {
        key: {
          required: true
        }
      }
    };

    prompt.message = 'Geolocation';
    prompt.get(schema, function (err, result) {
      vcap['user-provided'][2].credentials.key = result.key;
      resolve({predefined, vcap});
    });

  });

}

function storeNewFile(fileContent) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path.join(__dirname, 'dch_vcap.json'), JSON.stringify(fileContent, null, 1), err => err ? reject(err) : resolve());
  });
}

program
 .command('init')
 .description('Initalize the local credentials file. Uses dch_vcap_sample.json as a starting point.')
 .action( function() {
  console.log("Start initalizing credentials...");

  checkPredefinedServices().
  then(initServices).
  then(storeNewFile).
  catch(errLogger).
  then(() => {
    if(program.sampleSetup) {
        console.log(
`############################
  Setup Sample
############################`
      );
      console.log('Note: This might take a while. So sit back and relax :)');
      let child = exec(`node ${path.join(__dirname, 'sampledata', 'samplesetup.js')} init --all`);

      child.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
      });

      child.stderr.on('data', function (data) {
       console.log('stderr: ' + data);
      });

      child.on('close', function (code) {
        console.log('All done :)');
        console.log('Have fun and goodbye!');
        console.log('Exit Code: ', code);
        process.exit(0);
      });

    } else {
      console.log('All done :)');
      console.log('Have fun and goodbye!');
      process.exit(0);
    }
  });

 });

program.parse(process.argv);