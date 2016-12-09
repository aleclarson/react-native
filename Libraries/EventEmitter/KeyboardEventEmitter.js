/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule KeyboardEventEmitter
 */
'use strict';

const NativeEventEmitter = require('NativeEventEmitter');
const NativeModules = require('NativeModules');

module.exports = new NativeEventEmitter(NativeModules.KeyboardObserver);
