/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

var path = require('path');
var mm = require('micromatch');

var sharedWhitelist = [
  'react-native/node_modules/react-timer-mixin/**',
  'react/src/renderers/dom/client/syntheticEvents/SyntheticEvent.js',
  'react/src/test/ReactPerf.js',
];

// Don't forget to everything listed here to `package.json`
// modulePathIgnorePatterns.
var sharedBlacklist = [
  'react/src/test/**',
  'react/src/renderers/dom/**',

  // For each of these fbjs files (especially the non-forks/stubs), we should
  // consider deleting the conflicting copy and just using the fbjs version.
  //
  // fbjs forks:
  'fbjs/src/__forks__/Promise.js',
  'fbjs/src/__forks__/URI.js',
  'fbjs/src/__forks__/fetch.js',
  // fbjs stubs:
  'fbjs/src/stubs/ErrorUtils.js',
  // fbjs modules:
  'fbjs/src/core/dom/**',
  'fbjs/src/core/Deferred.js',
  'fbjs/src/core/PromiseMap.js',
  'fbjs/src/core/areEqual.js',
  'fbjs/src/core/flattenArray.js',
  'fbjs/src/core/isEmpty.js',
  'fbjs/src/core_windowless/removeFromArray.js',
  'fbjs/src/core/resolveImmediate.js',
  'fbjs/src/core/sprintf.js',
  'fbjs/src/crypto/base62.js',
  'fbjs/src/crypto/crc32.js',
  'fbjs/src/fetch/fetchWithRetries.js',
  'fbjs/src/functional/everyObject.js',
  'fbjs/src/functional/filterObject.js',
  'fbjs/src/functional/forEachObject.js',
  'fbjs/src/functional/someObject.js',
  'fbjs/src/request/xhrSimpleDataSerializer.js',
  'fbjs/src/useragent/UserAgent.js',
  'fbjs/src/utils/nullthrows.js',

  // Those conflicts with the ones in fbjs/. We need to blacklist the
  // internal version otherwise they won't work in open source.
  'downstream/core/CSSCore.js',
  'downstream/core/TouchEventUtils.js',
  'downstream/core/camelize.js',
  'downstream/core/createArrayFromMixed.js',
  'downstream/core/createNodesFromMarkup.js',
  'downstream/core/dom/containsNode.js',
  'downstream/core/dom/focusNode.js',
  'downstream/core/dom/getActiveElement.js',
  'downstream/core/dom/getUnboundedScrollPosition.js',
  'downstream/core/dom/isNode.js',
  'downstream/core/dom/isTextNode.js',
  'downstream/core/emptyFunction.js',
  'downstream/core/emptyObject.js',
  'downstream/core/getMarkupWrap.js',
  'downstream/core/hyphenate.js',
  'downstream/core/hyphenateStyleName.js',
  'downstream/core/invariant.js',
  'downstream/core/nativeRequestAnimationFrame.js',
  'downstream/core/toArray.js',
];

var platformBlacklists = {
  web: '*.(ios|android).*',
  ios: '*.(web|android).*',
  android: '*.(web|ios).*',
};

function platformBlacklist(platform) {
  const blacklist = platformBlacklists[platform];
  return blacklist && mm.makeRe('**/' + blacklist);
}

function blacklist(patterns) {
  patterns = patterns ? patterns.concat(sharedBlacklist) : sharedBlacklist;
  return mm.makeRe('**/(' + patterns.join('|') + ')');
}

function whitelist(patterns) {
  patterns = patterns ? patterns.concat(sharedWhitelist) : sharedWhitelist;
  return mm.makeRe('**/(' + patterns.join('|') + ')');
}

module.exports = {
  platformBlacklist: platformBlacklist,
  blacklist: blacklist,
  whitelist: whitelist,
};
