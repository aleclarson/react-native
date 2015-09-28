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
var parseErrorStack = require('parseErrorStack');
var printErrorStack = require('printErrorStack');
var stringifySafe = require('stringifySafe');

var sourceMapPromise;

var exceptionID = 0;

function reportException(e: Error, isFatal: bool, stack?: any) {
  var currentExceptionID = ++exceptionID;
  if (RCTExceptionsManager) {
    if (!stack) {
      stack = parseErrorStack(e);
    }
    if (isFatal) {
      RCTExceptionsManager.reportFatalException(e.message, stack, currentExceptionID);
    } else {
      RCTExceptionsManager.reportSoftException(e.message, stack, currentExceptionID);
    }
    if (__DEV__) {

      log.moat(1);
      log.yellow('Loading source maps!');
      log.moat(1);

      if (sourceMapPromise == null) {
        sourceMapPromise = loadSourceMapForBundle();
      }

      sourceMapPromise.then(map => {

        // Map the bundle to the original JS files.
        var stack = parseErrorStack(e, map);
        RCTExceptionsManager.updateExceptionMessage(e.message, stack);

        // Map the JS files to any original dialects.
        Q.all(
          stack.map(frame =>
            loadSourceMapForFile(frame.file)
              .fail(() => null)))

        .then(sourceMaps => {
          stack.forEach((frame, index) => {
            var sourceMap = sourceMaps[index];
            if (!sourceMap) { return }
            resolveSourceMaps(sourceMap, frame);
          });
          printErrorStack(error, stack);
          RCTExceptionsManager.updateExceptionMessage(e.message, stack);
        })
      })

      .fail(error => {
        // This can happen in a variety of normal situations, such as
        // Network module not being available, or when running locally
        log.error(Error('Unable to load source map: ' + error.message), {
          simple: true,
          exit: false,
        });
      });
    }
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
