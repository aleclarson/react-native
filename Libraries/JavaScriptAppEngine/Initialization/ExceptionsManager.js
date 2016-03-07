/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ExceptionsManager
 * @flow
 */
'use strict';

var exceptionID = 0;

global._bundleSourceMap = null;

/**
 * Handles the developer-visible aspect of errors and exceptions
 */
function reportException(error: Exception, isFatal: bool, stack?: any) {

  // if (!__DEV__) {
  //   return;
  // }

  var RCTExceptionsManager = require('NativeModules').ExceptionsManager;
  if (!RCTExceptionsManager) {
    return;
  }

  var Q = require ('q');
  var parseErrorStack = require('parseErrorStack');
  var filterErrorStack = require('filterErrorStack');
  var resolveSourceMaps = require('resolveSourceMaps');
  var { loadSourceMapForBundle, loadSourceMapForFile } = require('loadSourceMap');

  if (!stack) {
    stack = parseErrorStack(error);
  }

  var currentExceptionID = ++exceptionID;

  error = {
    message: error.message,
    stack: stack.filter(frame =>
      frame instanceof Object
    ),
  };

  if (isFatal) {
    RCTExceptionsManager.reportFatalException(error.message, error.stack, currentExceptionID);
  } else {
    RCTExceptionsManager.reportSoftException(error.message, error.stack, currentExceptionID);
    return;
  }

  if (global._bundleSourceMap === null) {
    global._bundleSourceMap = loadSourceMapForBundle();
  }

  global._bundleSourceMap.then(bundleSourceMap => {

    // Map the bundle to the original JS files.
    parseErrorStack(error, bundleSourceMap);

    // Filter out frames without an original JS file.
    stack = stack.filter(frame =>
      frame == null ||
      typeof frame === 'string' ||
      frame.file.indexOf('/http:/') !== 0
    );

    // Filter out frames that have blacklisted files.
    stack = filterErrorStack(stack);

    // Keep `error.stack` in sync with `stack`.
    error.stack = stack.filter(frame =>
      frame instanceof Object
    );

    RCTExceptionsManager.updateExceptionMessage(
      error.message,
      error.stack,
      currentExceptionID
    );

    // Map the JS files to any original dialects.
    Q.all(
      error.stack.map(frame =>
        loadSourceMapForFile(frame.file)
          // Ignore file-specific loading failures.
          .fail(error => null)
      )
    )

    .then(sourceMaps => {
      error.stack.forEach((frame, index) => {
        var sourceMap = sourceMaps[index];
        if (sourceMap) {
          resolveSourceMaps(sourceMap, frame);
        }
      });

      RCTExceptionsManager.updateExceptionMessage(
        error.message,
        error.stack,
        currentExceptionID
      );
    })

    .done();
  });
}

module.exports = { reportException };
