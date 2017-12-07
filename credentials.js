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

// then(() => {
//     if(program.sampleSetup) {
//         console.log(`
// ############################
//   Setup Sample
// ############################
// `      );
//       console.log('Note: This might take a while. So sit back and relax :)');
//       let child = exec(`node ${path.join(__dirname, 'sampledata', 'samplesetup.js')} init --all`);

//       child.stdout.on('data', function (data) {
//         console.log('stdout: ' + data);
//       });

//       child.stderr.on('data', function (data) {
//        console.log('stderr: ' + data);
//       });

//       child.on('close', function (code) {
//         console.log('All done :)');
//         console.log('Have fun and goodbye!');
//         console.log('Exit Code: ', code);
//         process.exit(0);
//       });

//     } else {
//       console.log('All done :)');
//       console.log('Have fun and goodbye!');
//       process.exit(0);
//     }
//   }).
//   catch(errLogger);

/** Node Based Setup Script */

const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const cfenv = require('cfenv');
const program = require('commander');
const prompt = require('prompt');
const homedir = require('os').homedir;
const cwd = process.cwd;

const credentials = require('wch-conversation-core/lib/plugins/credentials');

const settingsPath = path.join(cwd(), 'app_settings.json');

const errLogger = err => {console.log('Something fishy happened :('); console.log('Error: ', err.stack)};

program
  .version('0.1.0')
  .option('-a, --app-settings [settingsPath]', 'Path to app settings json', settingsPath)
  .option('-k, --key [privateKey]', 'Path to private RSA key', path.join(homedir(), '.ssh', 'id_rsa'))
  .option('-S, --sample-setup', 'Trigger sample creation after credentials setup');

program
 .command('manage')
 .description('Create or update the given credentials to run the app locally. Will update your app settings based on your decisions.')
 .action(() => {
    checkForAppSettings(path.resolve(program.appSettings))
    .then(initGeneralSettings)
    .then(checkForCredentials)
    .then(initCredentials)
    .then(setupConversationService)
    .then(setupWCH)
    .then(setupToneAnalyzer)
    .then(setupLanguageTranslator)
    .then(setupGeolocation)
    .then(setupMongoDb)
    .then(setupSlack)
    .then(setupAlexa)
    .then(setupFB)
    .then(() => {
      console.log('\n\n');
      console.log('<<<<<<<<<<<<<<<<<<<<<<');
      console.log('| All done. Enjoy ;) |');
      console.log('>>>>>>>>>>>>>>>>>>>>>>');
      process.exit(0);
    })
    .catch(console.log);
  });

program.parse(process.argv);

function checkForAppSettings (setPath) {
  return new Promise((resolve, reject) => {
    let settingsExist = fs.existsSync(setPath);
    if (settingsExist) {
      let file = fs.readFileSync(setPath);
      let settings = JSON.parse(file);
      resolve({setExist: true, setPath: setPath, appSettings: settings});
    } else {
      resolve({setExist: false, setPath: setPath});
    }
  });
}

function checkForCredentials (parameters) {
  let {setExist, setPath, appSettings} = parameters;
  return new Promise((resolve, reject) => {
    try {
      let credsPath = appSettings.generalSettings.credentialsStore.path;
      let credsExist = fs.existsSync(appSettings.generalSettings.credentialsStore.path);
      if (credsExist) {
        let file = fs.readFileSync(credsPath, 'utf8');
        let appCredentials = file;
        resolve(Object.assign(parameters, {credsExist , credsPath, appCredentials}));
      }
      else {
        resolve(Object.assign(parameters, {credsExist , credsPath}));
      }
    } catch (err) {
      console.log(err);
      reject(err);
    }
  });
}

function initGeneralSettings (parameters) {
  let {setExist, setPath, appSettings} = parameters;
  return new Promise((resolve, reject) => {
    if(setExist) {
      // Nothing to do...
      return resolve(parameters);
    }
    console.log('Welcome to the Watson Content Hub Chatbot Integration Sample!');
    console.log('It seems that you are using the application for the first time.');
    console.log('Let\'s start with some general questions about your setup.');

    // Default General Settings
    let generalSettings = {
      "defaultLanguage": "en",
      "supportedLanguages": [
       "de",
       "en"
      ],
      "developermode": true,
      "confLvl": "0.7",
      "credentialsStore": {
       "path": "./dch_vcap.json",
       "encrypted": true,
       "pathPrivKey": "C:\\Users\\SvenSterbling\\.ssh\\id_rsa"
      },
      "debugToFile": false
    };

    let schema = {
      properties: {
        skip: {
          description: `We will store the settings at the given location: ${setPath}. Is that okay?`,
          pattern: /^[y|n]$/,
          required: true,
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        supportedLanguages: {
          description: 'Please give a comma separated list of supported languages.',
          default: generalSettings.supportedLanguages,
          required: false,
          ask: () => prompt.history('skip').value === 'y'
        },
        defaultLanguage: {
          description: 'What is the default language?',
          default: generalSettings.defaultLanguage,
          required: false,
          ask: () => prompt.history('skip').value === 'y',
          conform: function (value) {
            return prompt.history('supportedLanguages').value.split(',').includes(value);
          },
          message: `Please select a language from the supported languages.`
        },
        developermode: {
          description: 'If enabled you get detailed error messages. Recommended during development. Do not enable this in production.',
          type: 'boolean',
          required: false,
          default: generalSettings.developermode,
          ask: () => prompt.history('skip').value === 'y'
        },
        confLvl: {
          description: 'General confidential level. Discard results below and use the fallback/default.',
          required: false,
          default: generalSettings.confLvl,
          ask: () => prompt.history('skip').value === 'y'
        },
        credentialsPath: {
          description: 'Where do you want to store your credentials?',
          type: 'string',
          required: false,
          default: generalSettings.credentialsStore.path,
          ask: () => prompt.history('skip').value === 'y'
        },
        encrypt : {
          description: 'Do you want to encrypt your files with your RSA key? If you don\'t have a key yet check this out: https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/',
          type: 'boolean',
          required: false,
          default: generalSettings.credentialsStore.encrypted,
          ask: () => prompt.history('skip').value === 'y',
          message: 'Please answer with true or false'
        },
        pathPrivKey : {
          description: 'Provide the path to your private key you want to use for encryption.',
          required: false,
          default: generalSettings.credentialsStore.pathPrivKey,
          conform: (value) => fs.existsSync(path.resolve(value)),
          ask: () => prompt.history('skip').value === 'y' && prompt.history('encrypt').value
        },
        debugToFile : {
          description: 'If tracing is enabled should the log be persisted into a file?',
          pattern: /^[y|n]$/,
          required: true,
          default:  generalSettings.debugToFile ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        }
      }
    };

    prompt.start();
    prompt.message = 'General Settings';
    prompt.get(schema, function (err, result) {
      if(!result || result.skip === 'n') {
        console.log('\nBye!');
        process.exit(0);
      }

      let initSettings = {
        title: "Default Application Settings for Conversation Core",
        description: "This file contains all configurable parts of the application. When you want to use plugins from the core service create this file in your own project or extend this one.",
        generalSettings: {
          defaultLanguage : result.defaultLanguage,
          supportedLanguages: result.supportedLanguages.split(','),
          developermode: result.developermode,
          confLvl: result.confLvl,
          credentialsStore: {
            path: result.credentialsPath,
            encrypted: result.encrypt,
            pathPrivKey: result.pathPrivKey
          },
          debugToFile: result.debugToFile === 'y' ? true : false,
          channels: {}
        }
      }
      let newSettings = Object.assign({}, appSettings, initSettings);
      storeFile(setPath, newSettings).then(() => {
        resolve(Object.assign(parameters, {appSettings: newSettings}));
      })
    });
  });
}

function initCredentials (parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials} = parameters;
  let {encrypted, pathPrivKey} = appSettings.generalSettings.credentialsStore;
  return new Promise((resolve, reject) => {
    if (credsExist) {
      return credentials({
              pubKPath: pathPrivKey,
              privKPath: pathPrivKey,
              encrypted: encrypted,
              credsPath: credsPath,
              readOnly: false
            },
            { logging: () => ({methodEntry: (name, value) => value, methodExit: (name, value) => value, debug: (name, value) => value }) },
            (_this, credentialsService) => {
              let defaultCredsService = credentialsService.credentials;
              defaultCredsService
              .decrypt({credentials: appCredentials})
              .then(JSON.parse)
              .then(decryptedSettings => {
                resolve(Object.assign({}, parameters, {appCredentials: decryptedSettings, defaultCredsService}));
              })
              .catch(console.log);
            });
    }

    let privKeyExists = fs.existsSync(path.resolve(pathPrivKey));
    let schema = {
        properties: {
          skip: {
            description: `We will store the credentials at the given location: ${path.resolve(credsPath)}. Is that okay?`,
            pattern: /^[y|n]$/,
            required: true,
            message: `Please answer with 'y' for yes and 'n' for no!`
          },
          pathPrivKey : {
              description: `Could not find your RSA key. If you don\'t have a key yet check this out: https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/`,
              required: false,
              default: pathPrivKey,
              ask: () => prompt.history('skip').value === 'y' && !privKeyExists,
              conform: (value) => fs.existsSync(path.resolve(value)),
              message: 'File does not exist!'
          }

        }
      }

      prompt.start();
      prompt.message = 'Init credentials';
      prompt.get(schema, function (err, result) {
          if(!result || result.skip === 'n') {
            console.log('\nBye!');
            process.exit(0);
          }
          appSettings.generalSettings.credentialsStore.pathPrivKey = result.pathPrivKey;
          storeFile(setPath, appSettings)
          .then(() => {

            credentials({
              pubKPath: pathPrivKey,
              privKPath: pathPrivKey,
              encrypted: encrypted,
              credsPath: credsPath,
              readOnly: false
            },
            { logging: () => ({methodEntry: (name, value) => value, methodExit: (name, value) => value, debug: (name, value) => value }) },
            (_this, credentialsService) => {
              let defaultCredsService = credentialsService.credentials;
              resolve(Object.assign(parameters, {appCredentials: {}, defaultCredsService}));
            });

          });

        });
  });
};

function setupConversationService (parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials, defaultCredsService} = parameters;
  return new Promise((resolve, reject) => {
    console.log('\n############################\n  Setup Conversation Service \n############################\n');
    console.log('Note: You can find all parameters on bluemix. Make sure to name the service as defined in bluemix!');
    console.log('Please provide the following parameters:');

    let defaultConversation;
    if (appCredentials.conversation && appCredentials.conversation.length >= 0) {
      defaultConversation = appCredentials.conversation[0];
    }
    else {
      defaultConversation = {
         "credentials": {
          "url": "",
          "username": "",
          "password": ""
         },
         "name": "wch-conversation"
        };
    }

    let schema = {
      properties: {
        name: {
          required: true,
          default: defaultConversation.name
        },
        url: {
          required: true,
          default: defaultConversation.credentials.url
        },
        username: {
          required: true,
          default: defaultConversation.credentials.username
        },
        password: {
          required: true,
          default: defaultConversation.credentials.password,
          hidden: true,
          replace: '*'
        }
      }
    };
    prompt.message = 'Conversation';
    prompt.get(schema, function (err, result) {
      if (!result) {
        console.log('\nBye!');
        process.exit(0);
      }

      appSettings.conversationMiddleware = appSettings.conversationMiddleware ? appSettings.conversationMiddleware : {};
      let config = appSettings.conversationMiddleware.config ? appSettings.conversationMiddleware.config : [];

      appSettings.generalSettings.supportedLanguages.forEach(lang => {
        let currConMid = config.find(ele => ele.locale === lang);
        if (!currConMid || !currConMid.workspaceId) {
          currConMid = {workspaceId: '<Missing Workspace ID>',locale: lang};
          config.push(currConMid);
        }
      });

      appSettings.conversationMiddleware = Object.assign({}, appSettings.conversationMiddleware, {config: config});

      console.log('NEWNAME ', result.name)

      let newConversation = [
        {
         "credentials": {
          "url": result.url,
          "username": result.username,
          "password": result.password
         },
         "name": result.name
        }
      ]
      appCredentials.conversation = newConversation;
      Promise.all([
        storeFile(setPath, appSettings),
        defaultCredsService.store({credentials: appCredentials})
      ])
      .then(() => {
        resolve(Object.assign(parameters, appCredentials));
      });
    });
  });
}

function setupToneAnalyzer (parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials, defaultCredsService} = parameters;
  return new Promise((resolve, reject) => {
    console.log('\n############################\n  Setup Tone Analyzer \n############################\n');
    console.log('Note: You can find all parameters on bluemix. Make sure to name the service as defined in bluemix!');
    console.log('Please provide the following parameters:');

    let defaultToneAnalyzer;
    if (appCredentials.tone_analyzer && appCredentials.tone_analyzer.length >= 0) {
      defaultToneAnalyzer = appCredentials.tone_analyzer[0];
    }
    else {
      defaultToneAnalyzer = {
         "credentials": {
          "url": "",
          "username": "",
          "password": ""
         },
         "name": "wch-toneanalyzer"
        };
    }
    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use the Tone Analyzer? Otherwise we can skip it. (y/n)',
          default: (appSettings.toneAnalyzerService && appSettings.toneAnalyzerService.enabled) ? 'y' : 'n',
          pattern: /^[y|n]$/,
          required: true,
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        name: {
          required: true,
          default: defaultToneAnalyzer.name,
          ask: () => prompt.history('skip').value === 'y'
        },
        url: {
          required: true,
          default: defaultToneAnalyzer.credentials.url,
          ask: () => prompt.history('skip').value === 'y'
        },
        username: {
          required: true,
          default: defaultToneAnalyzer.credentials.username,
          ask: () => prompt.history('skip').value === 'y'
        },
        password: {
          required: true,
          default: defaultToneAnalyzer.credentials.password,
          hidden: true,
          replace: '*',
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };
    prompt.message = 'ToneAnalyzer';
    prompt.get(schema, function (err, result) {
      if (!result) {
        console.log('\nBye!');
        process.exit(0);
      }

      let toneAnalyzernabled = (result.skip === 'y');
      appSettings.toneAnalyzerService = Object.assign({}, appSettings.toneAnalyzerService, {enabled: toneAnalyzernabled})

      let newToneAnalyzer = [
        {
         "credentials": {
          "url": result.url,
          "username": result.username,
          "password": result.password
         },
         "name": result.name
        }
      ]
      appCredentials = Object.assign({}, appCredentials, {tone_analyzer:newToneAnalyzer});
      Promise.all([
        storeFile(setPath, appSettings),
        defaultCredsService.store({credentials: appCredentials})
      ])
      .then(() => {
        resolve(Object.assign(parameters, appCredentials));
      });
    });

  });

}

function setupLanguageTranslator (parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials, defaultCredsService} = parameters;
  return new Promise((resolve, reject) => {
    console.log('\n############################\n  Setup Langauge Translator \n############################\n');
    console.log('Note: You can find all parameters on bluemix. Make sure to name the service as defined in bluemix!');
    console.log('Please provide the following parameters:');
    let defaultLanguageTranslator;
    if (appCredentials.language_translator && appCredentials.language_translator.length >= 0) {
      defaultLanguageTranslator = appCredentials.language_translator[0];
    }
    else {
      defaultLanguageTranslator = {
         "credentials": {
          "url": "",
          "username": "",
          "password": ""
         },
         "name": "wch-languagetranslator"
        };
    }

    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use the Tone Langauge Translator? Otherwise we can skip it. (y/n)',
          pattern: /^[y|n]$/,
          required: true,
          default: (appSettings.languageTranslationService && appSettings.languageTranslationService.enabled) ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        name: {
          required: true,
          default: defaultLanguageTranslator.name,
          ask: () => prompt.history('skip').value === 'y'
        },
        url: {
          required: true,
          default: defaultLanguageTranslator.credentials.url,
          ask: () => prompt.history('skip').value === 'y'
        },
        username: {
          required: true,
          default: defaultLanguageTranslator.credentials.username,
          ask: () => prompt.history('skip').value === 'y'
        },
        password: {
          required: true,
          default: defaultLanguageTranslator.credentials.password,
          hidden: true,
          replace: '*',
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };
    prompt.message = 'LanguageTranslator';
    prompt.get(schema, function (err, result) {
      if (!result) {
        console.log('\nBye!');
        process.exit(0);
      }

      let languageAnalyzerEnabled = (result.skip === 'y');
      appSettings.languageTranslationService = Object.assign({}, appSettings.languageTranslationService, {enabled: languageAnalyzerEnabled})

      let newLanguageTranslator = [
        {
         credentials: {
          url: result.url,
          username: result.username,
          password: result.password
         },
         name: result.name
        }
      ]
      Object.assign(appCredentials, {language_translator:newLanguageTranslator});
      Promise.all([
        storeFile(setPath, appSettings),
        defaultCredsService.store({credentials: appCredentials})
      ])
      .then(() => {
        console.log('appCredentials ', appCredentials.language_translator)
        resolve(Object.assign(parameters, appCredentials));
      });
    });
  });

}

function setupGeolocation (parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials, defaultCredsService} = parameters;
  return new Promise((resolve, reject) => {
    console.log('\n############################\n  Setup Geolocation \n############################\n');
    console.log('Note: You can find all parameters on google developers.');
    console.log('Please provide the following parameters:');

    let defaultGeolocation;
    if (appCredentials['user-provided']
      && appCredentials['user-provided'].length >= 0
      && appCredentials['user-provided'].find(ele => ele.name === 'geo_config')) {
      defaultGeolocation = appCredentials['user-provided'].find(ele => ele.name === 'geo_config');
    }
    else {
      defaultGeolocation = {
        credentials: {
          key:""
        },
        name: 'geo_config'
      };
    }
    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use the geolocation API? Otherwise we can skip it. (y/n)',
          pattern: /^[y|n]$/,
          required: true,
          default: (appSettings.geolocationService && appSettings.geolocationService.enabled) ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        key: {
          required: true,
          default: defaultGeolocation.credentials.key,
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };
    prompt.message = 'Geolocation';
    prompt.get(schema, function (err, result) {
      if (!result) {
        console.log('\nBye!');
        process.exit(0);
      }

      let geolocationEnabled = (result.skip === 'y');
      appSettings.geolocationService = Object.assign({}, appSettings.geolocationService, {enabled: geolocationEnabled})

      if (!appCredentials['user-provided']) {
        appCredentials['user-provided'] = [];
      }

      let newGeolocation = {
         credentials: {
           key: result.key
         },
         name: 'geo_config'
        };

      let index = appCredentials['user-provided'].findIndex(ele => ele.name === 'geo_config');
      if (index > -1) {
        appCredentials['user-provided'][index] = newGeolocation;
      } else {
        appCredentials['user-provided'].push(newGeolocation);
      }

      Promise.all([
        storeFile(setPath, appSettings),
        defaultCredsService.store({credentials: appCredentials})
      ])
      .then(() => {
        resolve(Object.assign(parameters, appCredentials));
      });
    });

  });
}

function setupWCH(parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials, defaultCredsService} = parameters;
  return new Promise((resolve, reject) => {
    console.log('\n############################\n  Setup WCH \n############################\n');
    console.log('Note: You can find all parameters when logged into the WCH authoring UI.');
    console.log('Please provide the following parameters:');

    let defaultWCH;
    if (appCredentials['user-provided']
      && appCredentials['user-provided'].length >= 0
      && appCredentials['user-provided'].find(ele => ele.name === 'wch_config')) {
      defaultWCH = appCredentials['user-provided'].find(ele => ele.name === 'wch_config');
    }
    else {
      defaultWCH = {
        credentials: {
          apiurl: '',
          hubid: '',
          username: '',
          password: ''
        },
        name: 'wch_config'
      };
    }
    let schema = {
      properties: {
        apiurl: {
          description: 'Please provide the api url. e.g. https://my.digitalexperience.ibm.com/api/dsa3sa-das2dfa-2fasagg-2dassdas',
          required: true,
          default: defaultWCH.credentials.apiurl
        },
        hubid: {
          description: 'Please provide the Hub Id. e.g. dsa3sa-das2dfa-2fasagg-2dassdas',
          required: true,
          default: defaultWCH.credentials.hubid
        },
        username: {
          description: 'Please provide a valid username for your content hub. e.g. mytechnical@blueid.com',
          required: true,
          default: defaultWCH.credentials.username
        },
        password: {
          hidden: true,
          required: true,
          replace: '*',
          default: defaultWCH.credentials.password
        },
        caching: {
          description: 'Do you want to cache responses from WCH? Recommended for production. (y/n)',
          pattern: /^[y|n]$/,
          required: true,
          default: (appSettings.wchService && appSettings.wchService.caching) ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        }
      }
    };
    prompt.message = 'WCH';
    prompt.get(schema, function (err, result) {
      if (!result) {
        console.log('\nBye!');
        process.exit(0);
      }

      let cachingEnabled = (result.caching === 'y');
      appSettings.wchService = Object.assign({}, appSettings.wchService, {caching: cachingEnabled, ttl: 300});

      if (!appCredentials['user-provided']) {
        appCredentials['user-provided'] = [];
      }

      let newWCH = {
        credentials: {
          apiurl: result.apiurl,
          hubid: result.hubid,
          username: result.username,
          password: result.password
         },
         name: 'wch_config'
        };

      let index = appCredentials['user-provided'].findIndex(ele => ele.name === 'wch_config');
      if (index > -1) {
        appCredentials['user-provided'][index] = newWCH;
      } else {
        appCredentials['user-provided'].push(newWCH);
      }

      Promise.all([
        storeFile(setPath, appSettings),
        defaultCredsService.store({credentials: appCredentials})
      ])
      .then(() => {
        resolve(Object.assign(parameters, appCredentials));
      });
    });

  });
}

function setupMongoDb (parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials, defaultCredsService} = parameters;
  return new Promise((resolve, reject) => {
    console.log('\n############################\n  Setup Mongo DB \n############################\n');
    console.log('Please provide the following parameters:');

    let defaultMongo;
    if (appCredentials['user-provided']
      && appCredentials['user-provided'].length >= 0
      && appCredentials['user-provided'].find(ele => ele.name === 'db_config')) {
      defaultMongo = appCredentials['user-provided'].find(ele => ele.name === 'db_config');
    }
    else {
      defaultMongo = {
        credentials: {
          mongoUri: "https://..."
        },
        name: 'db_config'
      };
    }
    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use a mongo db to persist all data? Otherwise we can skip it. (y/n)',
          pattern: /^[y|n]$/,
          required: true,
          default: (appSettings.dbService && appSettings.dbService.enabled) ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        mongoUri: {
          description: 'Url to Mongo DB',
          required: true,
          default: defaultMongo.credentials.mongoUri,
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };
    prompt.message = 'DB';
    prompt.get(schema, function (err, result) {
      if (!result) {
        console.log('\nBye!');
        process.exit(0);
      }

      let dbEnabled = (result.skip === 'y');
      appSettings.dbService = Object.assign({}, appSettings.dbService, {enabled: dbEnabled})

      if (!appCredentials['user-provided']) {
        appCredentials['user-provided'] = [];
      }

      let newDb = {
        credentials: {
          key: result.key,
          verificationtoken: result.verificationtoken
         },
         name: 'db_config'
        };

      let index = appCredentials['user-provided'].findIndex(ele => ele.name === 'db_config');
      if (index > -1) {
        appCredentials['user-provided'][index] = newDb;
      } else {
        appCredentials['user-provided'].push(newDb);
      }

      Promise.all([
        storeFile(setPath, appSettings),
        defaultCredsService.store({credentials: appCredentials})
      ])
      .then(() => {
        resolve(Object.assign(parameters, appCredentials));
      });
    });

  });
}

// Channels

function setupAlexa (parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials, defaultCredsService} = parameters;
  return new Promise((resolve, reject) => {
    console.log('\n############################\n  Setup Alexa \n############################\n');
    console.log('Note: You can find all parameters in your Alexa Skill.');
    console.log('Please provide the following parameters:');

    let defaultAlexa;
    if (appCredentials['user-provided']
      && appCredentials['user-provided'].length >= 0
      && appCredentials['user-provided'].find(ele => ele.name === 'alexa_config')) {
      defaultAlexa = appCredentials['user-provided'].find(ele => ele.name === 'alexa_config');
    }
    else {
      defaultAlexa = {
        credentials: {
          appid: "amzn1.ask.skill.s0m3-c00l-idt0-y0ur-4pplicat10n"
        },
        name: 'alexa_config'
      };
    }
    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use alexa as an output channel? Otherwise we can skip it. (y/n)',
          pattern: /^[y|n]$/,
          required: true,
          default: (appSettings.channels.alexa && appSettings.channels.alexa.enabled) ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        appid: {
          description: 'Skill Id',
          required: true,
          default: defaultAlexa.credentials.appid,
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };
    prompt.message = 'Alexa';
    prompt.get(schema, function (err, result) {
      if (!result) {
        console.log('\nBye!');
        process.exit(0);
      }

      let AlexaEnabled = (result.skip === 'y');
      appSettings.channels.alexa = Object.assign({}, appSettings.channels.alexa, {enabled: AlexaEnabled})

      if (!appCredentials['user-provided']) {
        appCredentials['user-provided'] = [];
      }

      let newAlexa = {
        credentials: {
          appid: result.appid
         },
         name: 'alexa_config'
        };

      let index = appCredentials['user-provided'].findIndex(ele => ele.name === 'alexa_config');
      if (index > -1) {
        appCredentials['user-provided'][index] = newAlexa;
      } else {
        appCredentials['user-provided'].push(newAlexa);
      }

      Promise.all([
        storeFile(setPath, appSettings),
        defaultCredsService.store({credentials: appCredentials})
      ])
      .then(() => {
        resolve(Object.assign(parameters, appCredentials));
      });
    });

  });
}

function setupFB (parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials, defaultCredsService} = parameters;
  return new Promise((resolve, reject) => {
    console.log('\n############################\n  Setup Facebook \n############################\n');
    console.log('Note: You can find all parameters in your Facebook App.');
    console.log('Please provide the following parameters:');

    let defaultFB;
    if (appCredentials['user-provided']
      && appCredentials['user-provided'].length >= 0
      && appCredentials['user-provided'].find(ele => ele.name === 'fb_config')) {
      defaultFB = appCredentials['user-provided'].find(ele => ele.name === 'fb_config');
    }
    else {
      defaultFB = {
        credentials: {
          key: "EAAPgptw8sFoBALT4S...",
          verificationtoken: "bq8DdfXUOLgDnwqcYuk9"
        },
        name: 'fb_config'
      };
    }
    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use facebook as an output channel? Otherwise we can skip it. (y/n)',
          pattern: /^[y|n]$/,
          required: true,
          default: (appSettings.channels.fb && appSettings.channels.fb.enabled) ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        key: {
          description: 'App Key',
          required: true,
          default: defaultFB.credentials.key,
          ask: () => prompt.history('skip').value === 'y'
        },
        verificationtoken: {
          description: 'Verification Token',
          required: true,
          default: defaultFB.credentials.verificationtoken,
          ask: () => prompt.history('skip').value === 'y'
        }
      }
    };
    prompt.message = 'Facebook';
    prompt.get(schema, function (err, result) {
      if (!result) {
        console.log('\nBye!');
        process.exit(0);
      }

      let FacebookEnabled = (result.skip === 'y');
      appSettings.channels.fb = Object.assign({}, appSettings.channels.fb, {enabled: FacebookEnabled})

      if (!appCredentials['user-provided']) {
        appCredentials['user-provided'] = [];
      }

      let newFB = {
        credentials: {
          key: result.key,
          verificationtoken: result.verificationtoken
         },
         name: 'fb_config'
        };

      let index = appCredentials['user-provided'].findIndex(ele => ele.name === 'fb_config');
      if (index > -1) {
        appCredentials['user-provided'][index] = newFB;
      } else {
        appCredentials['user-provided'].push(newFB);
      }

      Promise.all([
        storeFile(setPath, appSettings),
        defaultCredsService.store({credentials: appCredentials})
      ])
      .then(() => {
        resolve(Object.assign(parameters, appCredentials));
      });
    });

  });
}

function setupSlack (parameters) {
  let {setPath, appSettings, credsExist, credsPath, appCredentials, defaultCredsService} = parameters;
  return new Promise((resolve, reject) => {
    console.log('\n############################\n  Setup Slack \n############################\n');
    console.log('Note: You can find all parameters in your Slack App or Slack Bot. (https://api.slack.com/apps)');
    console.log('Please provide the following parameters:');

    let defaultSlack;
    if (appCredentials['user-provided']
      && appCredentials['user-provided'].length >= 0
      && appCredentials['user-provided'].find(ele => ele.name === 'slack_config')) {
      defaultSlack = appCredentials['user-provided'].find(ele => ele.name === 'slack_config');
    }
    else {
      defaultSlack = {
        credentials: {
          clientid: "302183092184.793721974214",
          clientsecret: "ecc462365ba57b11bgf37a79b9ab14b7",
          verificationtoken: "FqxMwFQwMLtUF06HjPaMC7kg",
          redirectUri: "https://<hostname>/oauth",
          testbot: "xoxb-13461321324-6J7fH2zk3QIyfAixjQzf9xP5"
        },
        name: 'slack_config'
      };
    }
    let schema = {
      properties: {
        skip: {
          description: 'Do you want to use Slack as an output channel? Otherwise we can skip it. (y/n)',
          pattern: /^[y|n]$/,
          required: true,
          default: (appSettings.channels.slack && appSettings.channels.slack.enabled) ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        useapp: {
          description: 'Do you want to use an Slack Application? Otherwise we can skip it. (y/n)',
          pattern: /^[y|n]$/,
          required: true,
          default: (appSettings.channels.slack && appSettings.channels.slack.startApp) ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        clientid: {
          description: 'Client Id',
          required: true,
          default: defaultSlack.credentials.clientid,
          ask: () => prompt.history('skip').value === 'y' && prompt.history('useapp').value === 'y'
        },
        clientsecret: {
          description: 'Client Secret',
          required: true,
          default: defaultSlack.credentials.clientsecret,
          ask: () => prompt.history('skip').value === 'y' && prompt.history('useapp').value === 'y'
        },
        clientsecret: {
          description: 'Client Secret',
          required: true,
          default: defaultSlack.credentials.clientsecret,
          ask: () => prompt.history('skip').value === 'y' && prompt.history('useapp').value === 'y'
        },
        verificationtoken: {
          description: 'Verification Token',
          required: true,
          default: defaultSlack.credentials.verificationtoken,
          ask: () => prompt.history('skip').value === 'y' && prompt.history('useapp').value === 'y'
        },
        redirectUri: {
          description: 'Redirect URL',
          required: true,
          default: defaultSlack.credentials.redirectUri,
          ask: () => prompt.history('skip').value === 'y' && prompt.history('useapp').value === 'y'
        },
        usebot: {
          description: 'Do you want to use a simple testbot as an output channel? Otherwise we can skip it. (y/n)',
          pattern: /^[y|n]$/,
          required: true,
          default: (appSettings.channels.slack && appSettings.channels.slack.startTestBot) ? 'y' : 'n',
          message: `Please answer with 'y' for yes and 'n' for no!`
        },
        testbot: {
          description: 'Testbot Token',
          required: true,
          default: defaultSlack.credentials.testbot,
          ask: () => prompt.history('skip').value === 'y' && prompt.history('usebot').value === 'y'
        }
      }
    };
    prompt.message = 'Slack';
    prompt.get(schema, function (err, result) {
      if (!result) {
        console.log('\nBye!');
        process.exit(0);
      }

      let SlackEnabled = (result.skip === 'y');
      let UseApp = (result.useapp === 'y');
      let UseBot = (result.usebot === 'y');
      appSettings.channels.slack = Object.assign({}, appSettings.channels.slack,
        {
          enabled: SlackEnabled,
          startApp: UseApp,
          startTestBot: UseBot
        })

      if (!appCredentials['user-provided']) {
        appCredentials['user-provided'] = [];
      }

      let newSlack = {
        credentials: {
          clientid: result.clientid,
          clientsecret: result.clientsecret,
          verificationtoken: result.verificationtoken,
          redirectUri: result.redirectUri,
          testbot: result.testbot
         },
         name: 'slack_config'
        };

      let index = appCredentials['user-provided'].findIndex(ele => ele.name === 'slack_config');
      if (index > -1) {
        appCredentials['user-provided'][index] = newSlack;
      } else {
        appCredentials['user-provided'].push(newSlack);
      }

      Promise.all([
        storeFile(setPath, appSettings),
        defaultCredsService.store({credentials: appCredentials})
      ])
      .then(() => {
        resolve(Object.assign(parameters, appCredentials));
      });
    });

  });
}

function storeFile(filename, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, JSON.stringify(content, null, 1), err => err ? reject(err) : resolve());
  });
}
