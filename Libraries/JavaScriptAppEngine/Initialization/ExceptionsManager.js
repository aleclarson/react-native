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

const SourceMapsCache = require('SourceMapsCache');

let exceptionID = 0;

function createException(error, isFatal, stack, onLoad) {
  const resolveSourceMaps = require('resolveSourceMaps');
  const filterErrorStack = require('filterErrorStack');
  const parseErrorStack = require('parseErrorStack');

  const exception = {
    id: ++exceptionID,
    isFatal: isFatal,
    reason: error.message,
    stack: stack || parseErrorStack(error),
  };

  SourceMapsCache.fetchMain(mainSourceMap => {

    exception.stack = exception.stack.filter(frame => {
      if (typeof frame === 'string') {
        return true;
      } else if (frame instanceof Object) {
        resolveSourceMaps(mainSourceMap, frame);
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
    return Promise.map(stack, (frame) =>
      SourceMapsCache
        .fetch({ modulePath: frame.file })
        .fail(error => null)) // Ignore file-specific loading failures.

    .then(sourceMaps => {
      stack.forEach((frame, index) => {
        const sourceMap = sourceMaps[index];
        if (sourceMap) {
          resolveSourceMaps(sourceMap, frame);
        }
      });

      onLoad(exception);
    });
  });
}

function reportException(error, isFatal, stack) {

  const RCTExceptionsManager = require('NativeModules').ExceptionsManager;
  if (!RCTExceptionsManager) {
    return;
  }

  createException(error, isFatal, stack, (exception) => {
    const stack = exception.stack.filter(frame => frame instanceof Object);
    const key = exception.isFatal ? 'reportFatalException' : 'reportSoftException';
    RCTExceptionsManager[key](exception.reason, stack, exception.id);
  });
}

module.exports = {
  reportException,
  createException,
};
