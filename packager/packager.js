/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

require('./dev');

const fs = require('fs');
const path = require('path');
const sync = require('io').sync;
const childProcess = require('child_process');
const http = require('http');
const isAbsolutePath = require('absolute-path');

const blacklist = require('./blacklist.js');
const chalk = require('chalk');
const checkNodeVersion = require('./checkNodeVersion');
const cpuProfilerMiddleware = require('./cpuProfilerMiddleware');
const connect = require('connect');
const formatBanner = require('./formatBanner');
const globalConfig = require('./react-packager/src/GlobalConfig');
const getDevToolsMiddleware = require('./getDevToolsMiddleware');
const loadRawBodyMiddleware = require('./loadRawBodyMiddleware');
const openStackFrameInEditorMiddleware = require('./openStackFrameInEditorMiddleware');
const parseCommandLine = require('./parseCommandLine.js');
const ReactPackager = require('./react-packager');
const statusPageMiddleware = require('./statusPageMiddleware.js');
const systraceProfileMiddleware = require('./systraceProfileMiddleware.js');
const webSocketProxy = require('./webSocketProxy.js');

var options = parseCommandLine([{
  command: 'port',
  default: 8081,
  type: 'string',
}, {
  command: 'skipflow',
  description: 'Disable flow checks'
}, {
  command: 'nonPersistent',
  description: 'Disable file watcher'
}, {
  command: 'transformer',
  type: 'string',
  default: require.resolve('./transformer.js'),
  description: 'Specify a custom transformer to be used (absolute path)'
}, {
  command: 'resetCache',
  description: 'Removes cached files',
  default: false,
}, {
  command: 'reset-cache',
  description: 'Removes cached files',
  default: false,
}]);

checkNodeVersion();

console.log(formatBanner(
  'Running packager on port ' + options.port + '.\n'+
  '\n' +
  'Keep this packager running while developing on any JS projects. Feel free ' +
  'to close this tab and run your own packager instance if you prefer.\n' +
  '\n' +
  'https://github.com/facebook/react-native', {
    marginLeft: 1,
    marginRight: 1,
    paddingBottom: 1,
  })
);

process.on('uncaughtException', function(e) {
  if (e.code === 'EADDRINUSE') {
    console.log(
      chalk.bgRed.bold(' ERROR '),
      chalk.red('Packager can\'t listen on port', chalk.bold(options.port))
    );
    console.log('Most likely another process is already using this port');
    console.log('Run the following command to find out which process:');
    console.log('\n  ', chalk.bold('lsof -n -i4TCP:' + options.port), '\n');
    console.log('You can either shut down the other process:');
    console.log('\n  ', chalk.bold('kill -9 <PID>'), '\n');
    console.log('or run packager on different port.');
  } else {
    console.log(chalk.bgRed.bold(' ERROR '), chalk.red(e.message));
    var errorAttributes = JSON.stringify(e);
    if (errorAttributes !== '{}') {
      console.error(chalk.red(errorAttributes));
    }
    console.error(chalk.red(e.stack));
  }
  console.log('\nSee', chalk.underline('http://facebook.github.io/react-native/docs/troubleshooting.html'));
  console.log('for common problems and solutions.');
  process.exit(1);
});

//
// Initialize directories to start crawling from.
//

var projectRoots = [
  process.cwd()
];

var internalRoots = sync.map([
  'Libraries',
  'node_modules/react-tools',
  'node_modules/react-timer-mixin',
], function(internalPath) {
  return path.resolve(__dirname, '../' + internalPath);
});

//
// Start the server.
//

var server = runServer(options);

webSocketProxy.attachToServer(server, '/debugger-proxy');

function getAppMiddleware(options) {
  var transformerPath = options.transformer;
  if (!isAbsolutePath(transformerPath)) {
    transformerPath = path.resolve(process.cwd(), transformerPath);
  }

  return ReactPackager.middleware({
    nonPersistent: options.nonPersistent,
    projectRoots: projectRoots,
    projectExts: globalConfig.projectExts,
    assetRoots: projectRoots.concat(globalConfig.assetRoots),
    assetExts: globalConfig.assetExts,
    internalRoots: internalRoots,
    blacklistRE: blacklist(),
    cacheVersion: '3',
    transformModulePath: transformerPath,
    resetCache: options.resetCache || options['reset-cache'],
    polyfillModuleNames: [
      require.resolve(
        '../Libraries/JavaScriptAppEngine/polyfills/document.js'
      ),
    ],
  });
}

function runServer(
  options,
  readyCallback
) {
  var app = connect()
    .use(loadRawBodyMiddleware)
    .use(getDevToolsMiddleware(options))
    .use(openStackFrameInEditorMiddleware)
    .use(statusPageMiddleware)
    .use(systraceProfileMiddleware)
    .use(cpuProfilerMiddleware)
    // Temporarily disable flow check until it's more stable
    //.use(getFlowTypeCheckMiddleware(options))
    .use(getAppMiddleware(options));

  sync.each(projectRoots, function(root) {
    app.use(connect.static(root));
  });

  app.use(connect.logger())
    .use(connect.compress())
    .use(connect.errorHandler());

  return http.createServer(app).listen(options.port, '::', function() {
    log.it('Server started: ', color.yellow('http://localhost:' + options.port));
  });
}
