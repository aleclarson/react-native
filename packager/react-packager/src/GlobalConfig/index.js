/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const Promise = require('Promise');
const has = require('has');
const path = require('path');
const syncFs = require('io/sync');

const { platformBlacklist, blacklist, whitelist } = require('../../../blacklist');

function GlobalConfig(filePath) {

  filePath = path.resolve(lotus.path, filePath);

  if (has(GlobalConfig._cache, filePath)) {
    return GlobalConfig._cache[filePath];
  }

  if (!syncFs.isFile(filePath)) {
    const error = Error('"' + filePath + '" is not a file that exists.');
    error.code = 404;
    throw error;
  }

  const self = Object.create(GlobalConfig.prototype);

  self.path = filePath;
  self.reload();

  return GlobalConfig._cache[filePath] = self;
}

GlobalConfig._cache = Object.create(null);

GlobalConfig.prototype = {

  reload: function() {
    let json;
    if (syncFs.exists(this.path)) {
      json = JSON.parse(syncFs.read(this.path));
    } else {
      json = {};
    }

    // Support custom extensions.
    this.projectExts = json.projectExts || ['js', 'jsx', 'json'];
    this.assetExts = json.assetExts || ['png'];

    // Support global path redirection.
    this.redirect = json.redirect || Object.create(null);

    const whitelistRE = whitelist(json.whitelist);
    this._whitelist = (filePath) =>
      whitelistRE.test(filePath);

    const blacklistRE = blacklist(json.blacklist);
    this._blacklist = (filePath) =>
      !this._whitelist(filePath) && blacklistRE.test(filePath);
  },

  getBlacklist: function(platform) {
    if (!platform) {
      return this._blacklist;
    }
    const blacklistRE = platformBlacklist(platform);
    if (!blacklistRE) {
      return () => false;
    }
    return (filePath) =>
      blacklistRE.test(filePath);
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
