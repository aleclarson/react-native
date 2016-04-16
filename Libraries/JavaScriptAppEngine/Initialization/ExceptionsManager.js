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

var loadSourceMap = require('loadSourceMap');
var Q = require ('q');

var exceptionID = 0;

GLOBAL.bundleMap = null;
GLOBAL.loadingBundleMap = null;

module.exports = {
  reportException,
  createException,
};

function getBundleMap(onLoad) {
  if (GLOBAL.bundleMap) {
    return onLoad(GLOBAL.bundleMap);
  }
  if (GLOBAL.loadingBundleMap) {
    return GLOBAL.loadingBundleMap.then(onLoad);
  }
  GLOBAL.loadingBundleMap =
    loadSourceMap.forBundle()
    .then(bundleSourceMap => {
      GLOBAL.bundleMap = bundleSourceMap;
      onLoad(bundleSourceMap);
      return bundleSourceMap;
    })
    .fail(error => {
      console.warn('Failed to load bundle source map!');
      console.log(error.stack);
      GLOBAL.loadingBundleMap = null;
      return null;
    });
}

function createException(error, isFatal, stack, onLoad) {
  var resolveSourceMaps = require('resolveSourceMaps');
  var filterErrorStack = require('filterErrorStack');
  var parseErrorStack = require('parseErrorStack');

  var exception = {
    id: ++exceptionID,
    isFatal: isFatal,
    reason: error.message,
    stack: stack || parseErrorStack(error),
  };

  getBundleMap(bundleSourceMap => {

    exception.stack = exception.stack.filter(frame => {
      if (typeof frame === 'string') {
        return true;
      } else if (frame instanceof Object) {
        resolveSourceMaps(bundleSourceMap, frame);
        return frame.file.indexOf('/http:/') !== 0;
      } else {
        return false;
      }
    });

    // Filter out frames that have blacklisted files.
    // exception.stack = filterErrorStack(exception.stack);

    stack = exception.stack.filter(frame => frame instanceof Object);

    if (stack.length === 0) {
      return;
    }

    // Map the JS files to any original dialects.
    return Q.all(
      stack.map(frame =>
        loadSourceMap
          .forFile(frame.file)
          .fail(error => null) // Ignore file-specific loading failures.
      )
    ).done(sourceMaps => {

      stack.forEach((frame, index) => {
        var sourceMap = sourceMaps[index];
        if (!sourceMap) { return; }
        resolveSourceMaps(sourceMap, frame);
      });

      onLoad(exception);
    });
  });
};

function reportException(error, isFatal, stack) {

  var RCTExceptionsManager = require('NativeModules').ExceptionsManager;
  if (!RCTExceptionsManager) {
    return;
  }

  createException(error, isFatal, stack, (exception) => {
    var stack = exception.stack.filter(frame => frame instanceof Object);
    var key = exception.isFatal ? 'reportFatalException' : 'reportSoftException';
    RCTExceptionsManager[key](exception.reason, stack, exception.id);
  });
};
