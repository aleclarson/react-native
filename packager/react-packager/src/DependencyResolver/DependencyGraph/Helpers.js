 /**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const path = require('path');

const globalConfig = require('../../GlobalConfig');
const isDescendant = require('../../lib/isDescendant');

class Helpers {
  constructor(options) {
    this._assetExts = options.assetExts;
    this._internalRoots = options.internalRoots;
  }

  shouldCrawlDir(filePath) {
    const internalRoots = this._internalRoots;
    for (let i = 0; i < internalRoots.length; i++) {
      if (isDescendant(internalRoots[i], filePath)) {
        filePath = path.relative(internalRoots[i], filePath);
      }
    }
    const ignoredPatterns = globalConfig.ignoredPatterns;
    if (ignoredPatterns && ignoredPatterns.test(filePath)) {
      return false;
    }
    return true;
  }

  isAssetFile(file) {
    return this._assetExts.indexOf(this.extname(file)) !== -1;
  }

  extname(name) {
    return path.extname(name).replace(/^\./, '');
  }

  mergeArrays(arrays) {
    const result = [];
    arrays.forEach((array) => {
      if (!Array.isArray(array)) {
        return;
      }
      array.forEach((item) =>
        result.push(item));
    });
    return result;
  }

  resolutionHash(modulePath, depName) {
    return `${path.resolve(modulePath)}:${depName}`;
  }
}

module.exports = Helpers;
