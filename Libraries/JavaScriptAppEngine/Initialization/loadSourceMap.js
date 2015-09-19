/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule loadSourceMap
 * @flow
 */

'use strict';

var Q = require('q');
var NativeModules = require('NativeModules');
var SourceMapConsumer = require('SourceMap').SourceMapConsumer;
var SourceMapURL = require('./source-map-url');

var RCTSourceCode = NativeModules.SourceCode;
var RCTNetworking = NativeModules.Networking;

function loadSourceMap(): Q.Promise {
  return fetchSourceMap()
    .then(map => new SourceMapConsumer(map));
}

function fetchSourceMap(): Q.Promise {
  if (global.RAW_SOURCE_MAP) {
    return Q(global.RAW_SOURCE_MAP);
  }

  if (!RCTSourceCode) {
    return Q.reject(new Error('RCTSourceCode module is not available'));
  }

  if (!RCTNetworking) {
    // Used internally by fetch
    return Q.reject(new Error('RCTNetworking module is not available'));
  }

  return Q.promise(RCTSourceCode.getScriptText)
    .then(extractSourceMapURL)
    .then((url) => {
      if (url === null) {
        return Q.reject(new Error('No source map URL found. May be running from bundled file.'));
      }
      return Q(url);
    })
    .then(fetch)
    .then(response => response.text())
}

function extractSourceMapURL({url, text, fullSourceMappingURL}): ?string {
  if (fullSourceMappingURL) {
    return fullSourceMappingURL;
  }
  var mapURL = SourceMapURL.getFrom(text);
  if (!mapURL) {
    return null;
  }
  var baseURL = url.match(/(.+:\/\/.*?)\//)[1];
  return baseURL + mapURL;
}

module.exports = loadSourceMap;
