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
const program = require('commander');
const prompt = require('prompt');

/* Load the files we want to modify */
if(!fs.existsSync(path.join(__dirname, 'dch_vcap_sample.json'))) {
  console.err("dch_vcap_sample.json is missing. Please make sure that the file exists and is not corrupted!");
  Process.exit(1);
}
const dch_vcap_local = (fs.existsSync(path.join(__dirname, 'dch_vcap.json'))) ? JSON.parse(fs.readFileSync('./dch_vcap.json').toString('utf-8')) : {};

/* Load the local credentials file */
const env = cfenv.getAppEnv({vcap: {
    services: dch_vcap_local
  }});

const errLogger = err => {console.log('Something fishy happened :('); console.log('Error: ', err.stack)};

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

program
 .command('init')
 .description('Initalize the local credentials file. Uses dch_vcap_sample.json as a starting point.')
 .action(() => {
  console.log('Welcome to the Watson Content Hub Chatbot Integration Sample!');
  console.log('Please follow the instructions of this setup in order to prepare the sample for usage.');
  console.log('Be aware that all passwords will be stored in clear text in the dch_vcap.json file at the moment!');

  checkPredefinedServices().
  catch(errLogger).
  then(initServices).
  catch(errLogger).
  then(storeNewFile).
  catch(errLogger).
  then(() => {
    if(program.sampleSetup) {
        console.log(`
############################
  Setup Sample
############################
`      );
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
  }).
  catch(errLogger);

 });

program.parse(process.argv);

//////////////////////////////
// Setup Credentials for Local Development or Sample Setup
//////////////////////////////

function checkPredefinedServices() {
  const isSetExp = /^(?!<).*(?!>)$/;
  return new Promise((resolve, reject) => {
    let predefined = {};
    let tone_analyzer = env.services['tone_analyzer'];
    if(tone_analyzer){
      let { url = '<>', username = '<>', password = '<>'} = tone_analyzer[0].credentials;
      predefined.tone_analyzer = isSetExp.test(url) && isSetExp.test(username) && isSetExp.test(password);
    } else {
      predefined.tone_analyzer = { url: false, username: false, password: false };
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
        let { apiurl = '<>', hostname = '<>', hubid = '<>', username = '<>', password = '<>'} = wch_config.credentials;
        predefined.wch = Object.assign({}, {
          apiurl: isSetExp.test(apiurl),
          contenthubid: isSetExp.test(hubid),
          username: isSetExp.test(username),
          password: isSetExp.test(password)
        });
      } else {
        predefined.wch = { apiurl: false, contenthubid: false, username: false, password: false };
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
      predefined.wch = { apiurl: false, hostname: false, contenthubid: false, username: false, password: false };
      predefined.geo = false;
      predefined.bot = { clientid: false, clientsecret: false, verificationtoken: false };
    }

    resolve(predefined);
  });
}

function initServices(predefined) {
  return new Promise((resolve, reject) => {
    const vcap     = JSON.parse(fs.readFileSync(path.join(__dirname, 'dch_vcap_sample.json')).toString('utf-8'));
    const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'app_settings.json')).toString('utf-8'));
    setupToneAnalyzer({predefined, vcap, settings}).
    then(setupConversationService).
    then(setupWCH).
    then(setupBot).
    then(setupGeo).
    then(setupFB).
    then(({vcap, settings}) => resolve({vcap, settings}));

  });
}

function setupToneAnalyzer({predefined, vcap, settings}) {
  return new Promise((resolve, reject) => {
    console.log(`
############################
  Setup Tone Analyzer
############################
`   );
    console.log('Note: You can find all parameters on Bluemix. Make sure to name the service wch-toneanalyzer!');
    console.log('Please provide the following parameters:');
    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use the Tone Analyzer? Otherwise we can skip it. (y/n)',
          pattern: /^y|n$/,
          required: true,
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        url: {
          required: true,
          ask: () => prompt.history('skip').value === 'y'
        },
        username: {
          required: true,
          ask: () => prompt.history('skip').value === 'y'
        },
        password: {
          required: true,
          hidden: true,
          replace: '*',
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };

    prompt.start();
    prompt.message = 'ToneAnalyzer';
    prompt.get(schema, function (err, result) {
      settings.wch_toneanalyzer.enabled = (result.skip === 'y');

      vcap.tone_analyzer[0].credentials = {
        url: result.url.trim(),
        username: result.username.trim(),
        password: result.password.trim()
      };
      resolve({predefined, vcap, settings});
    });

  });
}

function setupConversationService({predefined, vcap, settings}) {
  return new Promise((resolve, reject) => {
console.log(`
############################
  Setup Conversation Service
############################
`);
    console.log('Note: You can find all parameters on bluemix. Make sure to name the service wch-conversationservice!');
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
          required: true,
          hidden: true,
          replace: '*'
        }
      }
    };
    prompt.message = 'Conversation';
    prompt.get(schema, function (err, result) {
      vcap.conversation[0].credentials.url = result.url.trim();
      vcap.conversation[0].credentials.username = result.username.trim();
      vcap.conversation[0].credentials.password = result.password.trim();
      resolve({predefined, vcap, settings});
    });

  });

}

function setupWCH({predefined, vcap, settings}) {
  return new Promise((resolve, reject) => {
console.log(`
############################
  Setup Watson Content Hub
############################
`);
    console.log('You find all these information when logged into content hub at Profile > Hubinformation.');
    console.log('Please provide the following parameters:');
    let schema = {
      properties: {
        apiurl: {
          description: 'Please provide the api url. e.g. https://my.digitalexperience.ibm.com/api/dsa3sa-das2dfa-2fasagg-2dassdas',
          required: true
        },
        hubid: {
          description: 'Please provide the Hub Id. e.g. dsa3sa-das2dfa-2fasagg-2dassdas',
          required: true
        },
        username: {
          description: 'Please provide a valid username for your content hub. e.g. mytechnical@blueid.com',
          required: true
        },
        password: {
          hidden: true,
          required: true,
          replace: '*'
        }
      }
    };

    prompt.message = 'WCH';
    prompt.get(schema, function (err, result) {
      vcap['user-provided'][0].credentials.apiurl = result.apiurl;
      vcap['user-provided'][0].credentials.hubid = result.hubid.trim();
      vcap['user-provided'][0].credentials.username = result.username.trim();
      vcap['user-provided'][0].credentials.password = result.password.trim();
      resolve({predefined, vcap, settings});
    });

  });
}

function setupBot({predefined, vcap, settings}) {
  return new Promise((resolve, reject) => {
  console.log(`
############################
  Setup Slack Bot
############################
`);
  console.log('Please provide the following parameters:');

    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use the Slack Integration? Otherwise you can skip it. (y/n)',
          pattern: /^y|n$/,
          required: true,
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        clientid: {
          required: true,
          ask: () => prompt.history('skip').value === 'y'
        },
        clientsecret: {
          hidden: true,
          required: true,
          ask: () => prompt.history('skip').value === 'y'
        },
        verificationtoken: {
          ask: () => prompt.history('skip').value === 'y'
        },
        redirectUri: {
          ask: () => prompt.history('skip').value === 'y'
        },
        profcontent: {
          required: false,
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };

    prompt.message = 'SlackBot';
    prompt.get(schema, function (err, result) {
      settings.bot_config.enabled.slack = (result.skip === 'y');

      vcap['user-provided'][1].credentials.clientid = result.clientid;
      vcap['user-provided'][1].credentials.clientsecret = result.clientsecret;
      vcap['user-provided'][1].credentials.verificationtoken = result.verificationtoken;
      if(result.profcontent) vcap['user-provided'][1].credentials.profcontent = result.profcontent;
      resolve({predefined, vcap, settings});
    });

  });
}

function setupGeo({predefined, vcap, settings}) {
  return new Promise((resolve, reject) => {
    console.log(`
############################
  Setup Geolocation
############################
`);
    console.log('Please provide the following parameters:');

    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use the Google Geolocation Features? Otherwise you can skip it. (y/n)',
          pattern: /^y|n$/,
          required: true,
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        key: {
          required: true,
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };

    prompt.message = 'Geolocation';
    prompt.get(schema, function (err, result) {
      settings.geolocationservice.enabled = (result.skip === 'y');

      vcap['user-provided'][2].credentials.key = result.key;
      resolve({predefined, vcap, settings});
    });

  });

}

function setupFB({predefined, vcap, settings}) {
  return new Promise((resolve, reject) => {
    console.log(`
############################
  Setup Facebook
############################
`);
    console.log('Please provide the following parameters:');

    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use the Facebook Messenger Features? Otherwise you can skip it. (y/n)',
          pattern: /^y|n$/,
          required: true,
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        key: {
          required: true,
          ask: () => prompt.history('skip').value === 'y'
        },
        verificationtoken: {
          required: true,
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };

    prompt.message = 'Facebook';
    prompt.get(schema, function (err, result) {
      settings.bot_config.enabled.facebook = (result.skip === 'y');

      vcap['user-provided'][3].credentials.key = result.key;
      vcap['user-provided'][3].credentials.verificationtoken = result.verificationtoken;
      resolve({predefined, vcap, settings});
    });

  });

}

function storeFile(filename, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, JSON.stringify(content, null, 1), err => err ? reject(err) : resolve());
  });
}

function storeNewFile({vcap, settings}) {
  return new Promise((resolve, reject) => {
    Promise.all([
        storeFile(path.join(__dirname, 'dch_vcap.json'), vcap),
        storeFile(path.join(__dirname, 'app_settings.json'), settings)
      ]).
      catch(errLogger).
      then(() => resolve({vcap, settings}));
  });
}
