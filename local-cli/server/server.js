/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

// TODO: Support globally installed 'lotus'
require(process.env.LOTUS_PATH + '/lotus');

const checkNodeVersion = require('./checkNodeVersion');
const formatBanner = require('./formatBanner');
const runServer = require('./runServer');

/**
 * Starts the React Native Packager Server.
 */
function server(argv, config) {

  const args = parseArgv(argv);
  args.projectRoots = args.projectRoots
    ? argToArray(args.projectRoots)
    : config.getProjectRoots();

  checkNodeVersion();
  return runServer(args, config);
}

function parseArgv() {
  const parseCommandLine = require('../util/parseCommandLine');
  return parseCommandLine([{
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
}

function argToArray(arg) {
  return Array.isArray(arg) ? arg : arg.split(',');
}

module.exports = server;
