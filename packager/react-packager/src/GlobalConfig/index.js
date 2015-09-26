/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const Q = require('q');
const has = require('has');
const path = require('path');
const sync = require('io').sync;

function GlobalConfig(filePath) {

  filePath = path.resolve(lotus.path, filePath);

  if (has(GlobalConfig._cache, filePath)) {
    return GlobalConfig._cache[filePath];
  }

  if (!sync.isFile(filePath)) {
    throw Error(log.color.yellow(filePath) + ' is not a file that exists.');
  }

  const self = Object.create(GlobalConfig.prototype);

  self.path = filePath;
  self.reload();

  return GlobalConfig._cache[filePath] = self;
}

GlobalConfig._cache = Object.create(null);

GlobalConfig.prototype = {

  reload: function() {
    var json;
    if (sync.exists(this.path)) {
      json = JSON.parse(sync.read(this.path));
    } else {
      json = {};
    }

    this.assetExts = json.assetExts || ['png', 'jpeg', 'jpg'];

    if (json.ignoredPatterns) {
      this.ignoredPatterns = new RegExp('(^|\/)(' + json.ignoredPatterns.join('|') + ')(\/|$)');
    }

    log.moat(1);
    log.format(this, { label: 'Global config: ', unlimited: true });
    log.moat(1);
  },

  // Resolves a non-absolute path into an absolute path.
  // Relative to the directory that this GlobalConfig resides in.
  resolve: function(modulePath) {
    return path.isAbsolute(modulePath) ? modulePath :
      lotus.resolve(modulePath, this.path);
  },

  relative: function(modulePath) {
    return path.resolve(path.dirname(this.path), modulePath);
  }
};

module.exports = GlobalConfig('react-packager.json');
