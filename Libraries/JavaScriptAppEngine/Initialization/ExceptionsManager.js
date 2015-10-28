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

var RCTExceptionsManager = require('NativeModules').ExceptionsManager;

var { loadSourceMapForBundle, loadSourceMapForFile } = require('loadSourceMap');
var resolveSourceMaps = require('resolveSourceMaps');
var filterErrorStack = require('filterErrorStack');
var parseErrorStack = require('parseErrorStack');
var printErrorStack = require('printErrorStack');
var stringifySafe = require('stringifySafe');
var { fetch } = require('fetch');
var Q = require ('q');

var sourceMapPromise;

var exceptionID = 0;

global._fatalException = null;

function reportException(error: Exception, isFatal: bool, stack?: any) {

  if (!__DEV__ || !RCTExceptionsManager || global._fatalException){
    return;
  }

  if (!stack) {
    stack = parseErrorStack(error);
  }

  var currentExceptionID = ++exceptionID;

  error = {
    message: error.message,
    framesToPop: error.framesToPop,
    stack: stack.filter(frame =>
      typeof frame !== 'string'
    ),
  };

  if (error.computation) {
    stack = stack.concat(
      '--- Below is the stack trace of an invalidated Tracker.Computation ---',
      error.computation.stack
    );
  }

  if (isFatal) {
    global._fatalException = error;
    RCTExceptionsManager.reportFatalException(error.message, stack, currentExceptionID);
  } else {
    RCTExceptionsManager.reportSoftException(error.message, stack, currentExceptionID);
  }

  if (__DEV__ && isFatal) {

    if (sourceMapPromise == null) {
      sourceMapPromise = loadSourceMapForBundle();
    }

    sourceMapPromise.then(bundleSourceMap => {

      // Map the bundle to the original JS files.
      parseErrorStack(error, bundleSourceMap);

      // Filter out frames without an original JS file.
      stack = stack.filter(frame =>
        typeof frame === 'string' ||
        frame.file.indexOf('/http:/') !== 0
      );

      // Filter out frames that have blacklisted files.
      stack = filterErrorStack(stack);

      // Keep `error.stack` in sync with `stack`.
      error.stack = stack.filter(frame =>
        typeof frame !== 'string'
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
            .fail(error => log.it(error.message))
        )
      )

      .then(sourceMaps => {
        error.stack.forEach((frame, index) => {
          var sourceMap = sourceMaps[index];
          if (sourceMap) {
            resolveSourceMaps(sourceMap, frame);
          }
        });

        printErrorStack(error, stack);

        RCTExceptionsManager.updateExceptionMessage(
          error.message,
          error.stack,
          currentExceptionID
        );
      })

      .done();
    })

    .fail(error => {
      printErrorStack(error, parseErrorStack(error));
    });
  }
}

/**
 * Shows a redbox with stacktrace for all console.error messages.  Disable by
 * setting `console.reportErrorsAsExceptions = false;` in your app.
 */
function installConsoleErrorReporter() {
  if (console.reportException) {
    return; // already installed
  }
  console.reportException = reportException;
  console.errorOriginal = console.error.bind(console);
  console.error = function reactConsoleError() {
    // Note that when using the built-in context executor on iOS (i.e., not
    // Chrome debugging), console.error is already stubbed out to cause a
    // redbox via RCTNativeLoggingHook.
    console.errorOriginal.apply(null, arguments);
    if (!console.reportErrorsAsExceptions) {
      return;
    }
    var str = Array.prototype.map.call(arguments, stringifySafe).join(', ');
    if (str.slice(0, 10) === '"Warning: ') {
      // React warnings use console.error so that a stack trace is shown, but
      // we don't (currently) want these to show a redbox
      // (Note: Logic duplicated in polyfills/console.js.)
      return;
    }
    var error: any = new Error('console.error: ' + str);
    error.framesToPop = 1;
    reportException(error, /* isFatal */ false);
  };
  if (console.reportErrorsAsExceptions === undefined) {
    console.reportErrorsAsExceptions = true; // Individual apps can disable this
  }
}

module.exports = { reportException, installConsoleErrorReporter };
