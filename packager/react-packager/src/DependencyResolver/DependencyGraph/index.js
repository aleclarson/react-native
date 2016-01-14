 /**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const Activity = require('../../Activity');
const Fastfs = require('../fastfs');
const ModuleCache = require('../ModuleCache');
const Q = require('q');
const crawl = require('../crawlers');
const declareOpts = require('../../lib/declareOpts');
const isDescendant = require('../../lib/isDescendant');
const getPontentialPlatformExt = require('../../lib/getPlatformExtension');
const isAbsolutePath = require('absolute-path');
const {sync} = require('io');
const path = require('path');
const util = require('util');
const Helpers = require('./Helpers');
const ResolutionRequest = require('./ResolutionRequest');
const ResolutionResponse = require('./ResolutionResponse');
const HasteMap = require('./HasteMap');

const validateOpts = declareOpts({
  internalRoots: {
    type: 'array',
    required: true,
  },
  projectRoots: {
    type: 'array',
    required: true,
  },
  projectExts: {
    type: 'array',
    required: true,
  },
  assetServer: {
    type: 'object',
    required: true,
  },
  ignoreFilePath: {
    type: 'function',
    default: function(){}
  },
  fileWatcher: {
    type: 'object',
    required: true,
  },
  platforms: {
    type: 'array',
    default: ['ios', 'android'],
  },
  cache: {
    type: 'object',
    required: true,
  },
});

class DependencyGraph {
  constructor(options) {
    this._opts = validateOpts(options);
    this._cache = this._opts.cache;
    this._assetServer = this._opts.assetServer;
    this._helpers = new Helpers(this._opts);
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

    const depGraphActivity = Activity.startEvent('Building Dependency Graph');
    const crawlActivity = Activity.startEvent('Crawling File System');

    const roots = this._helpers.mergeArrays([
      this._opts.internalRoots,
      this._opts.projectRoots,
    ]);

    const exts = this._helpers.mergeArrays([
      this._opts.projectExts,
      this._assetServer._assetExts,
    ]);

    const ignorePath = (filepath) =>
      this._opts.ignoreFilePath(filepath) ||
        !this._helpers.shouldCrawlDir(filepath);

    this._crawling = crawl(roots, {
      exts: exts,
      ignore: ignorePath,
      fileWatcher: this._opts.fileWatcher,
    }).then((results) => {
      Activity.endEvent(crawlActivity);
      return results;
    });

    this._fastfs = new Fastfs(
      roots,
      this._opts.fileWatcher,
      {
        ignore: ignorePath,
        crawling: this._crawling,
      }
    );

    this._fastfs._detachedRoots.push(lotus.file);

    this._fastfs.on('change', this._processFileChange.bind(this));

    this._moduleCache = new ModuleCache(this._fastfs, this._cache);

    this._hasteMap = new HasteMap({
      fastfs: this._fastfs,
      moduleCache: this._moduleCache,
      ignore: (file) => !this._helpers.shouldCrawlDir(file),
    });

    this._loading = this._fastfs.build()
      .then(() => {
        const hasteActivity = Activity.startEvent('Building Haste Map');
        return this._hasteMap.build()
          .then(() => Activity.endEvent(hasteActivity));
      })
      .then(() => {
        const assetActivity = Activity.startEvent('Building Asset Map');
        this._assetServer._build(this._fastfs);
        Activity.endEvent(assetActivity);
      })
      .then(() => Activity.endEvent(depGraphActivity));

    return this._loading;
  }

  getDependencies(entryPath, { dev, platform }) {
    return this.load().then(() => {
      platform = this._getRequestPlatform(entryPath, platform);
      const absPath = this._getAbsolutePath(entryPath);
      const req = new ResolutionRequest({
        dev,
        platform,
        entryPath: absPath,
        hasteMap: this._hasteMap,
        assetServer: this._assetServer,
        helpers: this._helpers,
        moduleCache: this._moduleCache,
        fastfs: this._fastfs,
      });

      const response = new ResolutionResponse();

      return Q.all([
        req.getOrderedDependencies(response),
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

  _getRequestPlatform(entryPath, platform) {
    if (platform == null) {
      platform = getPontentialPlatformExt(entryPath);
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
    if (!this._helpers.shouldCrawlDir(absPath)) {
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
        this._hasteMapError = null;
        // Rebuild the entire map if last change resulted in an error.
        console.warn('Rebuilding haste map to recover from error');
        this._loading = this._hasteMap.build();
      } else {
        this._loading = this._hasteMap.processFileChange(type, absPath);
        this._loading.fail((e) => this._hasteMapError = e);
      }
      return this._loading;
    });
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
