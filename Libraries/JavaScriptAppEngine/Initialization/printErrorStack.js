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

function printErrorStack(reason, stack) {

  var message = '';

  message += 'Error: ' + reason + '\n\n';

  stack.forEach(function(frame) {
    if (typeof frame === 'string') {
      message += frame + '\n\n';
    } else {
      message += '  ' + frame.methodName + '\n' +
                 '  ' + frame.file +
                 ':' + frame.lineNumber +
                 ':' + frame.column +
                 '\n\n';
    }
  });

  console.log(message);
}

module.exports = printErrorStack;
