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

const cfenv = require('cfenv');
const dch_vcap_local = require('../dch_vcap');
const app_settings = require('../app_settings');
const wchpush = require('wchtools-cli/commands/push');
const conversation = require('../lib/services/conversation');
const WchConnector = require('sample-wch-node-connector');
const sync = require('../lib/sync');

const fs = require('fs');
const path = require('path');
const http = require('http');

const program = require('commander');

program
  .version('0.1.0')
  .option('-A, --all', 'Setup sample data on all backends')
  .option('-w, --wch', 'Setup the sample content for Watson Content Hub')
  .option('-s, --wch-no-sample-content', 'Setup the Watson Content Hub with the bare minimum to create a chatbot')
  .option('-c, --wcs', 'Setup the sample dialog for Watson Conversation Service')
  .option('-r, --node-red', 'Setup the sample flow for NODE-RED');

program.on('--help', function (){
  console.log('  Examples:');
  console.log('');
  console.log('    $ node ./sampledata/samplesetup.js -h');
  console.log('    $ node ./sampledata/samplesetup.js init ./dch_vcap.json');
  console.log('    $ node ./sampledata/samplesetup.js init');
  console.log('');
});

program
 .command('init [credentialsFile]')
 .description('Initalize the specific service. Uses the credentials from the given file.')
 .action(function (credsPath) {
    console.log('init "%s"', credsPath);
    let creds;
    if (credsPath && fs.existsSync(credsPath)) {
      // Read config file
      console.log('Reading credentials from path "%s" ', credsPath);
      let file = fs.readFileSync(credsPath);
      creds = JSON.parse(file);
    } else if(dch_vcap_local) {
      console.log('Reading credentials from default "../dch_vcap"');
      creds = dch_vcap_local;
    } else {
      console.error('Missing credentials! Please run setup.js first.');
      process.exit(1);
    }

    if (!program.all && !program.wch && !program.wcs && !program.nodeRed) {
      console.error('Missing options! Define which systems you want to setup. Use help for details.');
      process.exit(1);
    }

    // Setup Watson Content Hub
    if (program.all || program.wch) {
      let [ wch_config ] = creds['user-provided'];
      let { username, password, apiurl } = wch_config.credentials;

      if (!username || !password || !apiurl) {
        throw new Error('Missing parameters to push to wch. Make sure to have all credentials in place!');
      }

      let pushArgs = [
        process.argv[0], process.argv[1],
        "push", "-v", "-I", (program.wchNoSampleContent) ? "-tiCr" : "--all-authoring",
        "--user", username,
        "--password", password,
        "--url", apiurl,
        "--dir", path.join(__dirname, 'wch')
      ];

      let wchCommander = require('commander');
      wchpush(wchCommander);
      wchCommander.parse(pushArgs);
    }

    // Setup Watson Conversation Service
    if (program.all || program.wcs) {
      let workspace = JSON.parse(fs.readFileSync(path.join(__dirname, "wcs", "workspace.json")));
      conversation.createWorkspace( workspace,
        (err, resp) => {
          if (err) {
            console.log('An Error occured: ', err);
            process.exit(1);
          }
          console.log('Created Workspace with ID: ', resp.workspace_id);
          app_settings.wch_conversation.workspace_id.en = resp.workspace_id;
          fs.writeFileSync(path.join(__dirname, '..', 'app_settings.json'), JSON.stringify(app_settings, null, 1));
        }
      );
    }

    // Setup Node Red
    if (program.all || program.nodeRed) {
      let flows = fs.readFileSync(path.join(__dirname, 'nodered', 'chatbotflows.json'));

      let postData = flows;

      let options = {
        hostname: 'localhost',
        port: 1880,
        path: '/flows',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Node-RED-Deployment-Type': 'full'
        }
      };

      let req = http.request(options, res => {
        console.log(`Node Red status: ${res.statusCode}`);
        console.log(`Expected: 204`);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {});
        res.on('end', () => {
          console.log('Done Node RED Setup!');
        });
      });

      req.on('error', (e) => {
        console.error(`problem with request: ${e.message}. Propably Node RED is not started on your system or has enabled authentication.`);
      });

      req.write(postData);
      req.end();

    }

 });

program
  .command('cleanup [credentialsFile]')
  .description('Cleanup the sampledata from Watson Content Hub and the Conversation Service')
  .action(function(credsPath) {
    let creds;
    if (credsPath && fs.existsSync(credsPath)) {
      // Read config file
      console.log('Reading credentials from path "%s" ', credsPath);
      let file = fs.readFileSync(credsPath);
      creds = JSON.parse(file);
    } else if(dch_vcap_local) {
      console.log('Reading credentials from default "../dch_vcap"');
      creds = dch_vcap_local;
    } else {
      console.error('Missing credentials! Please run setup.js first.');
      process.exit(1);
    }

    // Setup Watson Content Hub
    if (program.all || program.wch) {
      let [ wch_config ] = creds['user-provided'];
      let { username, password, apiurl } = wch_config.credentials;

      if (!username || !password || !apiurl) {
        throw new Error('Missing parameters to push to wch. Make sure to have all credentials in place!');
      }

      let connector = new WchConnector({
        endpoint: 'authoring',
        baseUrl: apiurl,
        credentials: {
          usrname: username,
          pwd: password
        }
      });

      const maxDelAmount = 9999; // default
      let deleteItemQuery = 'classification:content AND type:(outputtext chatoutputtext chatactionbutton attachment chatattachment followup chatfollowup)';
      let deleteTypeQuery = 'classification:content-type AND name:(chatactionbutton attachment outputtext followup chatattachment chatoutputtext chatfollowup)';
      let deleteTaxonomiesQuery = 'classification:taxonomy AND name:(intents entities actions dialog_nodes emotion)';
      // First Cleanup All Content Items
      connector.content.deleteContentItems(deleteItemQuery, maxDelAmount)
      .then(result => console.log('RESULT CONTENT ', result))
      .then(() => connector.content.deleteContentTypes(deleteTypeQuery, maxDelAmount))
      .then(result => console.log('RESULT TYPES ', result))
      // Not yet possible - there's currently no way to identify the assets...
      // .then(() => connector.asset.deleteAssets('*:*', maxDelAmount))
      .then(() => connector.taxonomy.deleteTaxonomies(deleteTaxonomiesQuery, maxDelAmount))
      .then(() => console.log('Cleaned up!'));
    }

  });

program.parse(process.argv);
