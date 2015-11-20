/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule filterErrorStack
 */
'use strict';

var pathToRegex = function(parts) {
  return new RegExp('\/' + parts.replace('/', '\/') + '\/');
};

var blacklist = [
  pathToRegex('modules/q'),
  pathToRegex('modules/io'),
  pathToRegex('modules/react'),
  // pathToRegex('modules/type-utils'),
  pathToRegex('modules/react-native/packager'),
  pathToRegex('modules/react-native/node_modules'),
];

var shouldFilter = function(frame) {
  if (frame == null) {
    return true;
  }
  if (typeof frame !== 'string') {
    let i, length = blacklist.length;
    for (i = 0; i < length; i++) {
      if (blacklist[i].test(frame.file)) {
        return true;
      }
    }
  }
  return false;
};

var filter = function(stack) {
  return stack.filter(function(frame, index) {
    return index === 0 || !shouldFilter(frame);
  });
};

filter.shouldFilter = shouldFilter;

module.exports = filter;
