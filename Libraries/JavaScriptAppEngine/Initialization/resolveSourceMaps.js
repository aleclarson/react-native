/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule resolveSourceMaps
 */
'use strict';

var Path = require('path');

global.resolvedSourceMaps = {};

function onResolve(item, dest) {
  if (!resolvedSourceMaps[dest]) { resolvedSourceMaps[dest] = []; }
  resolvedSourceMaps[dest].push(item);
}

function resolveSourceMaps(sourceMapInstance, stackFrame) {
  try {
    var orig = sourceMapInstance.originalPositionFor({
      line: stackFrame.lineNumber,
      column: stackFrame.column,
    });
  } catch (_error) {
    // no-op
  }
  if (orig) {
    var dest = stackFrame.file;
    if (orig.source[0] === '.') {
      stackFrame.file = Path.resolve(Path.dirname(dest), orig.source);
    } else {
      stackFrame.file = orig.source;
    }
    stackFrame.lineNumber = orig.line;
    stackFrame.column = orig.column;
    onResolve(stackFrame, dest);
  } else {
    var error = Error('No source maps were found.');
    onResolve(error, dest);
  }
}

module.exports = resolveSourceMaps;
