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

const crypto = require('crypto');
const declareOpts = require('../lib/declareOpts');
const fs = require('fs');
const getAssetDataFromName = require('../lib/getAssetDataFromName');
const isAbsolutePath = require('absolute-path');
const path = require('path');

const stat = Q.denodeify(fs.stat);
const readDir = Q.denodeify(fs.readdir);
const readFile = Q.denodeify(fs.readFile);

const validateOpts = declareOpts({
  projectRoots: {
    type: 'array',
    required: true,
  },
  assetExts: {
    type: 'array',
    required: true,
  },
});

class AssetServer {
  constructor(options) {
    const opts = validateOpts(options);
    this._map = Object.create(null);
    this._roots = opts.projectRoots;
    this._assetExts = opts.assetExts;
  }

  resolve(assetPath, fastfs) {

    if (isAbsolutePath(assetPath)) {
      const extname = path.extname(file).replace(/^\./, '');
      const hasAssetExt = this._assetExts.indexOf(extname) !== -1;
      if (!hasAssetExt) {
        return;
      }

      const dirname = path.dirname(assetPath);
      if (!fastfs.dirExists(dirname)) {
        log
          .moat(1)
          .white('Error: ')
          .red(`Directory '${dirname}' does not exist!`)
          .moat(1);
        return;
      }

      const {name, type} = getAssetDataFromName(assetPath);

      let pattern = '^' + name + '(@[\\d\\.]+x)?';
      if (this._platform != null) {
        pattern += '(\\.' + this._platform + ')?';
      }
      pattern += '\\.' + type;

      const matches = fastfs.matches(
        dirname,
        new RegExp(pattern)
      );

      // We arbitrarily grab the first one,
      // because scale selection is done client-side.
      return matches[0];
    } else {
      const assetMatch = assetPath.match(/^image!(.+)/);
      if (assetMatch) {
        var assetName = assetMatch[1];
        const extname = path.extname(assetName).replace(/^\./, '');
        const hasAssetExt = this._assetExts.indexOf(extname) !== -1;
        if (!hasAssetExt) {
          assetName += '.png';
        }
        const asset = this._map[assetName];
        if (asset) {
          return asset.files[0];
        } else {
          log
            .moat(1)
            .white('Error: ')
            .red(`Asset '${assetName}' does not exist!`)
            .moat(1);
        }
      }
    }
  }

  get(assetPath, platform = null) {
    const assetData = getAssetDataFromName(assetPath);
    return this._getAssetRecord(assetPath, platform).then(record => {
      for (let i = 0; i < record.scales.length; i++) {
        if (record.scales[i] >= assetData.resolution) {
          return readFile(record.files[i]);
        }
      }

      return readFile(record.files[record.files.length - 1]);
    });
  }

  getAssetData(assetPath, platform = null) {
    const assetData = getAssetDataFromName(assetPath);

    return this._getAssetRecord(assetPath, platform).then(record => {
      assetData.scales = record.scales;
      assetData.files = record.files;

      return Q.all(
        record.files.map(file => stat(file))
      );
    }).then(stats => {
      const hash = crypto.createHash('md5');

      stats.forEach(fstat =>
        hash.update(fstat.mtime.getTime().toString())
      );

      assetData.hash = hash.digest('hex');
      return assetData;
    });
  }

  /**
   * Given a request for an image by path. That could contain a resolution
   * postfix, we need to find that image (or the closest one to it's resolution)
   * in one of the project roots:
   *
   * 1. We first parse the directory of the asset
   * 2. We check to find a matching directory in one of the project roots
   * 3. We then build a map of all assets and their scales in this directory
   * 4. Then try to pick platform-specific asset records
   * 5. Then pick the closest resolution (rounding up) to the requested one
   */
  _getAssetRecord(assetPath, platform = null) {
    return (
      this._findRoot(
        this._roots,
        path.dirname(assetPath)
      )
      .then(dir => Q.all([
        dir,
        readDir(dir),
      ]))
      .then(res => {
        const dir = res[0];
        const files = res[1];
        const { assetName } = getAssetDataFromName(assetPath);

        let record;
        if (platform != null) {
          const assetKey = getAssetKey(assetName, platform);
          record = this._map[assetKey] ||
                   this._map[assetName];
        } else {
          record = this._map[assetName];
        }

        if (!record) {
          throw new Error(
            `Asset not found: ${assetPath} for platform: ${platform}`
          );
        }

        return record;
      })
    );
  }

  _findRoot(roots, dir) {
    return Q.all(
      roots.map(root => {
        const absPath = path.join(root, dir);
        return stat(absPath).then(fstat => {
          return {path: absPath, isDirectory: fstat.isDirectory()};
        }, err => {
          return {path: absPath, isDirectory: false};
        });
      })
    ).then(stats => {
      for (let i = 0; i < stats.length; i++) {
        if (stats[i].isDirectory) {
          return stats[i].path;
        }
      }
      throw new Error('Could not find any directories');
    });
  }

  _build(fastfs) {
    fastfs.findFilesByExts(this._assetExts)
    .forEach((assetPath) => {
      const { assetName, platform, resolution } = getAssetDataFromName(assetPath);
      const assetKey = getAssetKey(assetName, platform);

      let record = this._map[assetKey];
      if (!record) {
        record = this._map[assetKey] = {
          scales: [],
          files: [],
        };
      }

      let insertIndex;
      const length = record.scales.length;

      for (insertIndex = 0; insertIndex < length; insertIndex++) {
        if (resolution <  record.scales[insertIndex]) {
          break;
        }
      }
      record.scales.splice(insertIndex, 0, resolution);
      record.files.splice(insertIndex, 0, assetPath);
    });
  }
}

function getAssetKey(assetName, platform) {
  if (platform != null) {
    return `${assetName} : ${platform}`;
  } else {
    return assetName;
  }
}

module.exports = AssetServer;
