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
const wchpush = require('wchtools-cli/commands/push');
const conversation = require('../lib/conversation');
const sync = require('../lib/sync');

const fs = require('fs');
const path = require('path');

const program = require('commander');
 
program
  .version('0.1.0')
  .option('-A, --all', 'Setup sample data on all backends')
  .option('-w, --wch', 'Setup the sample content for Watson Content Hub')
  .option('-s, --wch-no-sample-content', 'Setup the Watson Content Hub with the bare minimum to create a chatbot')
  .option('-c, --wcs', 'Setup the sample dialog for Watson Conversation Service');
  .option('-r, --node-red', 'Setup the sample flow for NODE-RED');

program.on('--help', function(){
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
 .action(function(credsPath) {
    console.log('init "%s"', credsPath);
    let creds;
    if(credsPath && fs.existsSync(credsPath)) {
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

    if(!program.all && !program.wch && !program.wcs && !program['node-red']) {
      console.error('Missing options! Define which systems you want to setup. Use help for details.');
      process.exit(1);
    }

    // Setup Watson Content Hub
    if(program.all || program.wch) {
      let [ wch_config ] = creds['user-provided'];
      let { username, password, baseurl } = wch_config.credentials;
      
      if(!username || !password || !baseurl) {
        throw new Error("Missing parameters to push to wch. Make sure to have all credentials in place!");
      }

      let pushArgs = [
        process.argv[0], process.argv[1], 
        "push", "-v", (wch-no-sample-content) ? "-tiCr" : "--all-authoring", 
        "--user", username, 
        "--password", password, 
        "--url", baseurl, 
        "--dir", path.join(__dirname, "wch")
      ];

      let wchCommander = require('commander');
      wchpush(wchCommander);
      wchCommander.parse(pushArgs);
    } 

    // Setup Watson Conversation Service
    if(program.all || program.wcs) {
      let file = fs.readFileSync(credsPath);
      let workspace = JSON.parse(fs.readFileSync(path.join(__dirname, "wcs", "workspace.json")));
      conversation.updateWorkspace (workspace,  
        (err, resp) => {
          if(err) {
            throw new Error(err);
          }
          console.log(resp);
        }
      );
    }

    // Create Sync between WCH & WCS
    if(program.all || (program.wcs && program.wch)) {
      sync.push({});
    }

    // Setup Node Red
    if(program.all || program['node-red']) {

    }

 });

program.parse(process.argv);
