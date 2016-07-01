/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const attachHMRServer = require('./util/attachHMRServer');
const connect = require('connect');
const cpuProfilerMiddleware = require('./middleware/cpuProfilerMiddleware');
const getDevToolsMiddleware = require('./middleware/getDevToolsMiddleware');
const http = require('http');
const isAbsolutePath = require('absolute-path');
const loadRawBodyMiddleware = require('./middleware/loadRawBodyMiddleware');
const messageSocket = require('./util/messageSocket.js');
const openStackFrameInEditorMiddleware = require('./middleware/openStackFrameInEditorMiddleware');
const path = require('path');
const ReactPackager = require('react-packager');
const statusPageMiddleware = require('./middleware/statusPageMiddleware.js');
const systraceProfileMiddleware = require('./middleware/systraceProfileMiddleware.js');
const webSocketProxy = require('./util/webSocketProxy.js');

function runServer(args, config, readyCallback) {
  var wsProxy = null;
  var ms = null;
  const packagerServer = getPackagerServer(args, config);
  const app = connect()
    .use(loadRawBodyMiddleware)
    .use(connect.compress())
    .use(getDevToolsMiddleware(args, () => wsProxy && wsProxy.isChromeConnected()))
    .use(getDevToolsMiddleware(args, () => ms && ms.isChromeConnected()))
    .use(openStackFrameInEditorMiddleware)
    .use(statusPageMiddleware)
    .use(systraceProfileMiddleware)
    .use(cpuProfilerMiddleware)
    .use(packagerServer.processRequest.bind(packagerServer));

  args.projectRoots.forEach(root => app.use(connect.static(root)));

  app.use(connect.logger())
    .use(connect.errorHandler());

  const serverInstance = http.createServer(app).listen(
    args.port,
    args.host,
    function() {
      attachHMRServer({
        httpServer: serverInstance,
        path: '/hot',
        packagerServer,
      });

      wsProxy = webSocketProxy.attachToServer(serverInstance, '/debugger-proxy');
      ms = messageSocket.attachToServer(serverInstance, '/message');
      webSocketProxy.attachToServer(serverInstance, '/devtools');

      log.moat(1);
      log.gray.dim('Listening...');
      log.moat(0);
      log.green('http://', require('ip').address(), ':', args.port);
      log.moat(1);
      readyCallback && readyCallback();
    }
  );
  // Disable any kind of automatic timeout behavior for incoming
  // requests in case it takes the packager more than the default
  // timeout of 120 seconds to respond to a request.
  serverInstance.timeout = 0;
}

function getPackagerServer(args, config) {

  // TODO: Load these from another module?
  const internalRoots = [
    'fbjs/src',
    'react/src',
    'react-native/Libraries',
    'react-native/node_modules/react-timer-mixin',
  ];

  const fileWatcher = ReactPackager.createFileWatcher({
    roots: args.projectRoots.concat(internalRoots),
    extensions: config.projectExts.concat(config.assetExts),
    nonPersistent: args.nonPersistent,
  });

  const transformModulePath =
    path.isAbsolute(args.transformer) ? args.transformer :
    path.resolve(process.cwd(), args.transformer);

  const { projectRoots, resetCache, verbose } = args;
  const { projectExts, assetExts } = config;

  printWatchedRoots(projectRoots);
  printWatchedExtensions(projectExts, assetExts);

  return ReactPackager.createServer({
    cacheVersion: '3',
    resetCache,
    fileWatcher,
    projectRoots,
    projectExts,
    assetExts,
    transformModulePath,
    verbose,
  });
}

function printWatchedRoots(projectRoots) {
  log.moat(1);
  log.white('Watching: ');
  log.plusIndent(2);
  if (projectRoots.length) {
    projectRoots.forEach(root => {
      log.moat(0);
      log.cyan(root);
    });
  } else {
    log.gray.dim('(empty)');
  }
  log.popIndent();
  log.moat(1);
}

function printWatchedExtensions(projectExts, assetExts) {
  log.moat(1);
  log.white('Valid extensions: ');
  log.plusIndent(2);
  if (projectExts.length || assetExts.length) {
    projectExts
      .concat(assetExts)
      .forEach(ext => {
        log.moat(0);
        log.yellow('.' + ext);
      });
  } else {
    log.moat(0);
    log.gray.dim('(empty)');
  }
  log.popIndent();
  log.moat(1);
}

module.exports = runServer;
