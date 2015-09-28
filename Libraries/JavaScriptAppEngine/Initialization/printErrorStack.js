/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule printErrorStack
 */
'use strict';

function printErrorStack(error, stack) {

  var message = '';

  message += 'Error: ' + error.message + '\n\n';

  stack.forEach(function(frame) {
    if (typeof frame === 'string') {
      message += frame + '\n\n';
    } else {
      message += '    file: '   + frame.file       + '\n' +
                 '    method: ' + frame.methodName + '\n' +
                 '    line: '   + frame.lineNumber + '\n' +
                 '    column: ' + frame.column     + '\n\n';
    }
  });

  console.error(message);
}

module.exports = printErrorStack;
