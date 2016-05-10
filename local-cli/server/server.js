/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const path = require('path');
const Promise = require('promise');

const checkNodeVersion = require('./checkNodeVersion');
const formatBanner = require('./formatBanner');
const parseCommandLine = require('../util/parseCommandLine');
const runServer = require('./runServer');

const log = require('log');
log.clear();
log.indent = 2;

/**
 * Starts the React Native Packager Server.
 */
function server(argv, config) {
  return new Promise((resolve, reject) => {
    _server(argv, config, resolve, reject);
  });
}

function _server(argv, config, resolve, reject) {
  const args = parseCommandLine([{
    command: 'port',
    default: 8081,
    type: 'string',
  }, {
    command: 'host',
    default: '',
    type: 'string',
  }, {
    command: 'projectRoots',
    type: 'string',
    description: 'override the root(s) to be used by the packager',
  }, {
    command: 'skipflow',
    description: 'Disable flow checks'
  }, {
    command: 'nonPersistent',
    description: 'Disable file watcher'
  }, {
    command: 'transformer',
    type: 'string',
    default: require.resolve('../../packager/transformer'),
    description: 'Specify a custom transformer to be used (absolute path)'
  }, {
    command: 'resetCache',
    description: 'Removes cached files',
    default: false,
  }, {
    command: 'reset-cache',
    description: 'Removes cached files',
    default: false,
  }, {
    command: 'verbose',
    description: 'Enables logging',
    default: false,
  }]);

  args.projectRoots = args.projectRoots
    ? argToArray(args.projectRoots)
    : config.getProjectRoots();

  checkNodeVersion();

  process.on('uncaughtException', error => {
    console.log(error.message);
    console.log(error.stack);
    // if (error.code === 'EADDRINUSE') {
    //   log
    //     .moat(1)
    //     .red('Error: ')
    //     .white('Port already in use: ')
    //     .yellow(args.port)
    //     .moat(1);
    // } else {
    //   log
    //     .moat(1)
    //     .red(error.type || error.constructor.name)
    //     .white(' ', error.message)
    //     .moat(1)
    //     .gray(error.stack)
    //     .moat(1);
    // }
    process.exit(1);
  });

  startServer(args, config);
}

function startServer(args, config) {
  var ip = require('ip');
  runServer(args, config, () => {
    log.moat(1);
    log.white('Server started: ');
    log.yellow('http://', ip.address(), ':', args.port);
    log.moat(1);
  });
}

function argToArray(arg) {
  return Array.isArray(arg) ? arg : arg.split(',');
}

module.exports = server;
