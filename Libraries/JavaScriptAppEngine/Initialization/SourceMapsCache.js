/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SourceMapsCache
 */
'use strict';

const getObjectValues = require('getObjectValues');
const SourceMapsUtils = require('SourceMapsUtils');
const SourceMapURL = require('./source-map-url');

const sourceMapsCache = Object.create(null);

const SourceMapsCache = {

  fetch({text, url, modulePath, fullSourceMappingURL}) {
    if (fullSourceMappingURL) {
      return fetchSourceMap(fullSourceMappingURL);
    }
    if (modulePath) {
      return fetchModuleSourceMap(modulePath);
    }
    return fetchSourceMap(
      SourceMapsUtils.extractSourceMapURL({text, url})
    );
  },

  fetchMain() {
    if (sourceMapsCache.main) {
      return sourceMapsCache.main;
    }
    return sourceMapsCache.main = SourceMapsUtils.fetchMainSourceMap();
  },

  getSourceMaps() {
    this.fetchMain();
    return Promise.map(getObjectValues(sourceMapsCache));
  },
};

function fetchSourceMap(sourceMappingURL) {
  const hash = sourceMappingURL.toLowerCase();
  if (sourceMapsCache[hash]) {
    return sourceMapsCache[hash];
  }
  return sourceMapsCache[hash] = SourceMapsUtils.fetchSourceMap(
    sourceMappingURL
  );
}

function fetchModuleSourceMap(modulePath) {
  if (modulePath[0] !== '/') {
    return Promise.reject(Error('"modulePath" must start with a "/".'));
  }

  return fetch('http://localhost:8081/read' + modulePath)

  .then(res => res.text())

  .then(text => SourceMapURL.getFrom(text))

  .then(mapURL => {
    if (!sourceMap) {
      throw Error('No source map: ' + modulePath);
    }
    const dirPath = modulePath.slice(0, modulePath.lastIndexOf('/'));
    const mapPath = Path.resolve(dirPath + '/' + mapURL);
    return fetchSourceMap('http://localhost:8081/read' + mapPath);
  });
}

module.exports = SourceMapsCache;
