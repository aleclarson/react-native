/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule flattenStyle
 * @flow
 */
'use strict';

var StyleSheetRegistry = require('StyleSheetRegistry');
var invariant = require('invariant');

import type { StyleObj } from 'StyleSheetTypes';

function getStyle(style) {
  if (typeof style === 'number') {
    return StyleSheetRegistry.getStyleByID(style);
  }
  return style;
}

function mergeStyles(style: Array<?Atom>) {
  var result = {};
  for (var i = 0; i < style.length; ++i) {
    var computedStyle = flattenStyle(style[i]);
    if (computedStyle) {
      for (var key in computedStyle) {
        var computedValue = computedStyle[key];
        if (computedValue != null) {
          result[key] = computedValue;
        }
      }
    }
  }
  return result;
}

function flattenStyle(style: ?StyleObj): ?Object {

  if (style == null) {
    return;
  }

  if (style === true) {
    throw Error('style cannot equal true');
  }

  if (Array.isArray(style)) {
    return mergeStyles(style);
  }

  if (typeof style === 'number') {
    return StyleSheetRegistry.getStyleByID(style);
  }

  return style;
}

module.exports = flattenStyle;
