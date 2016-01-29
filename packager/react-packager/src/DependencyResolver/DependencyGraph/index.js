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
const isAbsolutePath = require('absolute-path');
const {sync} = require('io');
const path = require('path');
const util = require('util');

const crawl = require('../crawlers');
const Fastfs = require('../fastfs');
const HasteMap = require('./HasteMap');
const ModuleCache = require('../ModuleCache');
const globalConfig = require('../../GlobalConfig');
const isDescendant = require('../../lib/isDescendant');
const ResolutionRequest = require('./ResolutionRequest');
const ResolutionResponse = require('./ResolutionResponse');
const getPlatformExtension = require('../lib/getPlatformExtension');

const defaultActivity = {
  startEvent: () => {},
  endEvent: () => {},
};

class DependencyGraph {
  constructor({
    internalRoots,
    projectRoots,
    projectExts,
    assetServer,
    activity,
    ignoreFilePath,
    fileWatcher,
    providesModuleNodeModules,
    platforms,
    preferNativePlatform,
    cache,
    extensions,
    mocksPattern,
    extractRequires,
    shouldThrowOnUnresolvedErrors = () => true,
  }) {
    this._opts = {
      internalRoots,
      projectRoots,
      projectExts,
      activity: activity || defaultActivity,
      ignoreFilePath: ignoreFilePath || (() => {}),
      fileWatcher,
      providesModuleNodeModules,
      platforms: platforms || [],
      preferNativePlatform: preferNativePlatform || false,
      extensions: extensions || ['js', 'jsx', 'json'],
      mocksPattern,
      extractRequires,
      shouldThrowOnUnresolvedErrors,
    };

    this._cache = cache;
    this._assetServer = assetServer;

    this.load().fail((err) => {
      // This only happens at initialization. Live errors are easier to recover from.
      console.error('Error building DependencyGraph:\n', err.stack);
      process.exit(1);
    });
  }

  load() {
    if (this._loading) {
      return this._loading;
    }

    const {activity} = this._opts;
    const depGraphActivity = activity.startEvent('Building Dependency Graph');
    const crawlActivity = activity.startEvent('Crawling File System');

    const roots = this._mergeArrays([
      this._opts.internalRoots,
      this._opts.projectRoots,
    ]);

    const exts = this._mergeArrays([
      this._opts.projectExts,
      this._assetServer._assetExts,
    ]);

    const ignorePath = (filepath) =>
      this._opts.ignoreFilePath(filepath) ||
        !this._shouldCrawlDir(filepath);

    this._crawling = crawl(roots, {
      exts: exts,
      ignore: ignorePath,
      fileWatcher: this._opts.fileWatcher,
    });

    this._crawling.then(() =>
      activity.endEvent(crawlActivity));

    this._fastfs = new Fastfs(
      'JavaScript',
      roots,
      this._opts.fileWatcher,
      {
        ignore: ignorePath,
        crawling: this._crawling,
        activity: activity,
      }
    );

    this._fastfs._detachedRoots.push(lotus.file);

    this._fastfs.on('change', this._processFileChange.bind(this));

    this._moduleCache = new ModuleCache(
      this._fastfs,
      this._cache,
      this._opts.extractRequires,
      this._helpers
    );

    this._hasteMap = new HasteMap({
      ignore: (file) => !this._shouldCrawlDir(file),
      fastfs: this._fastfs,
      extensions: this._opts.extensions,
      moduleCache: this._moduleCache,
      preferNativePlatform: this._opts.preferNativePlatform,
    });

    this._loading = this._fastfs.build()
      .then(() => {
        const hasteActivity = activity.startEvent('Building Haste Map');
        return this._hasteMap.build()
          .then(() => activity.endEvent(hasteActivity));
      })
      .then(() => {
        const assetActivity = activity.startEvent('Building Asset Map');
        this._assetServer._build(this._fastfs);
        activity.endEvent(assetActivity);
      })
      .then(() => activity.endEvent(depGraphActivity));

    return this._loading;
  }

  /**
   * Returns a promise with the direct dependencies the module associated to
   * the given entryPath has.
   */
  getShallowDependencies(entryPath) {
    return this._moduleCache.getModule(entryPath).getDependencies();
  }

  stat(filePath) {
    return this._fastfs.stat(filePath);
  }

  /**
   * Returns the module object for the given path.
   */
  getModuleForPath(entryFile) {
    return this._moduleCache.getModule(entryFile);
  }

  getDependencies(entryPath, platform) {
    return this.load().then(() => {
      platform = this._getRequestPlatform(entryPath, platform);
      const absPath = this._getAbsolutePath(entryPath);
      const req = new ResolutionRequest({
        platform,
        preferNativePlatform: this._opts.preferNativePlatform,
        entryPath: absPath,
        hasteMap: this._hasteMap,
        assetServer: this._assetServer,
        helpers: this._helpers,
        moduleCache: this._moduleCache,
        fastfs: this._fastfs,
        shouldThrowOnUnresolvedErrors: this._opts.shouldThrowOnUnresolvedErrors,
      });

      const response = new ResolutionResponse();

      return Q.all([
        req.getOrderedDependencies(response, this._opts.mocksPattern),
        req.getAsyncDependencies(response),
      ]).then(() => response);
    });
  }

  // Forces all modules to reload their contents on the next bundle request.
  refreshModuleCache() {
    this._moduleCache.refresh();
  }

  getDebugInfo() {
    var string = '';
    sync.each(this._moduleCache._moduleCache, (mod, absPath) => {
      string += '<h3>' + mod.path + '</h3><br/><br/>&nbsp;&nbsp;<h4>Dependencies:</h4><br/>';
      sync.each(mod._dependencies, (mod) => {
        string += '&nbsp;&nbsp;&nbsp;&nbsp;' + mod.path + '<br/>';
      });
      string += '<br/><br/>&nbsp;&nbsp;<h4>Dependers:</h4><br/>';
      sync.each(mod._dependers, (mod) => {
        string += '&nbsp;&nbsp;&nbsp;&nbsp;' + mod.path + '<br/>';
      });
      string += '<br/><br/>';
    });
    return string;
  }

  matchFilesByPattern(pattern) {
    return this.load().then(() => this._fastfs.matchFilesByPattern(pattern));
  }

  _getRequestPlatform(entryPath, platform) {
    if (platform == null) {
      platform = getPlatformExtension(entryPath);
      if (platform == null || this._opts.platforms.indexOf(platform) === -1) {
        platform = null;
      }
    } else if (this._opts.platforms.indexOf(platform) === -1) {
      throw new Error('Unrecognized platform: ' + platform);
    }
    return platform;
  }

  _getAbsolutePath(filePath) {
    if (isAbsolutePath(filePath)) {
      return path.resolve(filePath);
    }

    for (let i = 0; i < this._opts.projectRoots.length; i++) {
      const root = this._opts.projectRoots[i];
      const potentialAbsPath = path.join(root, filePath);
      if (this._fastfs.fileExists(potentialAbsPath)) {
        return path.resolve(potentialAbsPath);
      }
    }

    throw new NotFoundError(
      'Cannot find entry file %s in any of the roots: %j',
      filePath,
      this._opts.projectRoots
    );
  }

  _processFileChange(type, filePath, root, fstat) {
    const absPath = path.join(root, filePath);
    if (!this._shouldCrawlDir(absPath)) {
      return;
    }

    // Ok, this is some tricky promise code. Our requirements are:
    // * we need to report back failures
    // * failures shouldn't block recovery
    // * Errors can leave `hasteMap` in an incorrect state, and we need to rebuild
    // After we process a file change we record any errors which will also be
    // reported via the next request. On the next file change, we'll see that
    // we are in an error state and we should decide to do a full rebuild.
    this._loading = this._loading.always(() => {
      if (this._hasteMapError) {
        console.warn(
          'Rebuilding haste map to recover from error:\n' +
          this._hasteMapError.stack
        );
        this._hasteMapError = null;

        // Rebuild the entire map if last change resulted in an error.
        this._loading = this._hasteMap.build();
      } else {
        this._loading = this._hasteMap.processFileChange(type, absPath);
        this._loading.fail((e) => this._hasteMapError = e);
      }
      return this._loading;
    });
  }

  _shouldCrawlDir(filePath) {
    const internalRoots = this._opts.internalRoots;
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

  _mergeArrays(arrays) {
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
}

function NotFoundError() {
  Error.call(this);
  Error.captureStackTrace(this, this.constructor);
  var msg = util.format.apply(util, arguments);
  this.message = msg;
  this.type = this.name = 'NotFoundError';
  this.status = 404;
}
util.inherits(NotFoundError, Error);

module.exports = DependencyGraph;
