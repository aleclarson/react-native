/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
 'use strict';

var blacklist = require('../../packager/blacklist');
var path = require('path');
var rnpmConfig = require('./core/config');

var projectRoots = (function() {
  var root = process.env.REACT_NATIVE_APP_ROOT;
  if (root) {
    return [path.resolve(root)];
  }
  if (__dirname.match(/node_modules[\/\\]react-native[\/\\]react-native-cli$/)) {
    // Packager is running from node_modules.
    // This is the default case for all projects created using 'react-native init'.
    return [path.resolve(__dirname, '../../..')];
  } else if (__dirname.match(/Pods[\/\\]React[\/\\]packager$/)) {
     // React Native was installed using CocoaPods.
    return [path.resolve(__dirname, '../../..')];
  } else {
    return [path.resolve(__dirname, '..')];
  }
})();

/**
 * Default configuration for the CLI.
 *
 * If you need to override any of this functions do so by defining the file
 * `rn-cli.config.js` on the root of your project with the functions you need
 * to tweak.
 */
var config = {

  getProjectRoots() {
    return projectRoots;
  },

  /**
   * Specify where to look for assets that are referenced using
   * `image!<image_name>`. Asset directories for images referenced using
   * `./<image.extension>` don't require any entry in here.
   */
  getAssetRoots() {
    return projectRoots;
  },

  /**
   * Specify any additional asset extentions to be used by the packager.
   * For example, if you want to include a .ttf file, you would return ['ttf']
   * from here and use `require('./fonts/example.ttf')` inside your app.
   */
  getAssetExts() {
    return [];
  },

  /**
   * Returns a regular expression for modules that should be ignored by the
   * packager on a given platform.
   */
  getBlacklistRE() {
    return blacklist();
  },

  /**
   * Returns the path to a custom transformer. This can also be overridden
   * with the --transformer commandline argument.
   */
  getTransformModulePath() {
    return require.resolve('../../packager/transformer');
  },

  getProjectConfig: rnpmConfig.getProjectConfig,
  getDependencyConfig: rnpmConfig.getDependencyConfig,

  /**
   * Specifies which directories should be crawled when looking for Haste modules.
   * Any files with `@providesModule` at the top are added to the Haste map.
   * The benefit of a Haste module is importing it by its Haste name.
   */
  getHasteRoots() {
    return {
      'node_modules/react-native': ['Libraries'],
      'node_modules/react-native-web': ['src'],
      'node_modules/react-native-nodejs-api': ['lib', 'node_modules'],
    };
  },

  // Each key must be a valid platform: web, ios, android, global
  // Each value is the replacement mappings for its platform.
  // The 'global' platform is trumped by all others.
  getReplacements() {
    return {
      global: {
        'ReactInstanceMap': 'react-native/lib/ReactInstanceMap',
      },
      web: {
        'react-native': 'react-native-web',
        'react-native-web/lib': 'react-dom/lib',
        'react/lib/findNodeHandle': 'react-dom/lib/findDOMNode',
        'ReactComponentTree': 'react-dom/lib/ReactDOMComponentTree',
        'ReactTreeTraversal': 'react-dom/lib/ReactDOMTreeTraversal',
      },
      native: {
        'react-native/lib': 'react-native-renderer/lib',
        'ReactComponentTree': 'react-native/lib/ReactNativeComponentTree',
        'ReactTreeTraversal': 'react-native/lib/ReactNativeTreeTraversal',
      },
    };
  },

  // Returns a function that can redirect every required Haste module.
  // If no redirection is necessary, the function should return `toModuleName`.
  getRedirectRequire() {
    const platforms = this.getReplacements();
    if (platforms.native) {
      if (platforms.ios) {
        Object.assign(platforms.ios, platforms.native);
      } else {
        platforms.ios = platforms.native;
      }
      if (platforms.android) {
        Object.assign(platforms.android, platforms.native);
      } else {
        platforms.android = platforms.native;
      }
    }
    return function redirectRequire(fromModule, toModuleName, platform) {
      if (toModuleName[0] !== '.' && !path.isAbsolute(toModuleName)) {

        const replacement = getReplacement(
          toModuleName,
          platforms[platform] || {},
          platforms.global || {}
        );

        if (replacement != null) {
          // Perform more redirection if necessary.
          return redirectRequire(fromModule, replacement, platform);
        }
      }

      return toModuleName;
    };
  },
};

module.exports = config;

function getReplacement(toModuleName, platformReplacements, globalReplacements) {
  const parts = toModuleName.split('/');
  toModuleName = parts.shift();

  let replacement = platformReplacements[toModuleName];
  if (replacement == null) {
    replacement = globalReplacements[toModuleName];
  }

  while (replacement == null && parts.length) {
    toModuleName += '/' + parts.shift();

    replacement = platformReplacements[toModuleName];
    if (replacement == null) {
      replacement = globalReplacements[toModuleName];
    }
  }

  if (replacement != null && parts.length) {
    replacement += '/' + parts.join('/');
  }

  return replacement;
}
