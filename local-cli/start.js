/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

require('./env');

const runServer = require('./server/runServer');
const parseCommandLine = require('./util/parseCommandLine');

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
  default: lotus.resolve('react-packager/transform'),
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

// Start the server!
runServer(args, {
  // Configuration goes here.
});

function argToArray(arg) {
  return Array.isArray(arg) ? arg : arg.split(',');
}
