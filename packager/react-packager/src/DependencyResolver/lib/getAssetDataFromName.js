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
const isAbsolutePath = require('absolute-path');
const getPlatformExtension = require('./getPlatformExtension');

function getAssetDataFromName(assetPath) {

  if (assetPath.indexOf('/') !== -1) {
    assetPath = path.basename(assetPath);
  }

  const ext = path.extname(assetPath);
  const platformExt = getPlatformExtension(assetPath);

  let pattern = '@([\\d\\.]+)x';
  if (platformExt != null) {
    pattern += '(\\.' + platformExt + ')?';
  }
  pattern += '\\' + ext + '$';
  const re = new RegExp(pattern);

  const match = assetPath.match(re);
  let resolution;

  if (!(match && match[1])) {
    resolution = 1;
  } else {
    resolution = parseFloat(match[1], 10);
    if (isNaN(resolution)) {
      resolution = 1;
    }
  }

  let assetName;
  if (match) {
    assetName = assetPath.replace(re, ext);
  } else if (platformExt != null) {
    assetName = assetPath.replace(new RegExp(`\\.${platformExt}\\${ext}`), ext);
  } else {
    assetName = assetPath;
  }

  let asset = {
    resolution: resolution,
    assetName: assetName,
    type: ext.slice(1),
    name: path.basename(assetName, ext),
    platform: platformExt,
  };

  return asset;
}

module.exports = getAssetDataFromName;
