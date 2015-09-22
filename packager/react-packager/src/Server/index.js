/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const Activity = require('../Activity');
const AssetServer = require('../AssetServer');
const FileWatcher = require('../FileWatcher');
const Bundler = require('../Bundler');
const Q = require('q');

const has = require('has');
const steal = require ('steal');
const {sync} = require('io');
const mm = require('micromatch');
const _ = require('underscore');
const declareOpts = require('../lib/declareOpts');
const path = require('path');
const url = require('url');

const SERVER_API = require('./api');

const validateOpts = declareOpts({
  projectRoots: {
    type: 'array',
    required: true,
  },
  internalRoots: {
    type: 'array',
    default: [],
  },
  blacklistRE: {
    type: 'object', // typeof regex is object
  },
  moduleFormat: {
    type: 'string',
    default: 'haste',
  },
  polyfillModuleNames: {
    type: 'array',
    default: [],
  },
  cacheVersion: {
    type: 'string',
    default: '1.0',
  },
  resetCache: {
    type: 'boolean',
    default: false,
  },
  transformModulePath: {
    type:'string',
    required: false,
  },
  nonPersistent: {
    type: 'boolean',
    default: false,
  },
  assetRoots: {
    type: 'array',
    required: false,
  },
  assetExts: {
    type: 'array',
    default: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'],
  },
  transformTimeoutInterval: {
    type: 'number',
    required: false,
  },
});

const bundleOpts = declareOpts({
  sourceMapUrl: {
    type: 'string',
    required: false,
  },
  entryFile: {
    type: 'string',
    required: true,
  },
  dev: {
    type: 'boolean',
    default: true,
  },
  minify: {
    type: 'boolean',
    default: false,
  },
  refresh: {
    type: 'boolean',
    default: false,
  },
  runModule: {
    type: 'boolean',
    default: true,
  },
  inlineSourceMap: {
    type: 'boolean',
    default: false,
  },
  platform: {
    type: 'string',
    required: true,
  }
});

const dependencyOpts = declareOpts({
  platform: {
    type: 'string',
    required: true,
  },
  dev: {
    type: 'boolean',
    default: true,
  },
  entryFile: {
    type: 'string',
    required: true,
  },
});

class Server {
  constructor(options) {
    const opts = validateOpts(options);

    this._projectRoots = opts.projectRoots;
    this._bundles = Object.create(null);
    this._changeWatchers = [];

    const assetGlobs = opts.assetExts.map(ext => '**/*.' + ext);

    var watchRootConfigs = opts.projectRoots.map(dir => {
      return {
        dir: dir,
        globs: [
          '**/*.js',
          '**/*.json',
        ].concat(assetGlobs),
      };
    });

    if (opts.assetRoots != null) {
      watchRootConfigs = watchRootConfigs.concat(
        opts.assetRoots.map(dir => {
          return {
            dir: dir,
            globs: assetGlobs,
          };
        })
      );
    }

    this._fileWatcher = options.nonPersistent
      ? FileWatcher.createDummyWatcher()
      : new FileWatcher(watchRootConfigs);

    this._assetServer = new AssetServer({
      projectRoots: opts.projectRoots,
      assetExts: opts.assetExts,
    });

    const bundlerOpts = Object.create(opts);
    bundlerOpts.fileWatcher = this._fileWatcher;
    bundlerOpts.assetServer = this._assetServer;
    this._bundler = new Bundler(bundlerOpts);

    this._fileWatcher.on('all', this._onFileChange.bind(this));

    this._debouncedFileChangeHandler = _.debounce(filePath => {
      this._rebuildBundles(filePath);
      this._informChangeWatchers();
    }, 50);
  }

  end() {
    Q.all([
      this._fileWatcher.end(),
      this._bundler.kill(),
    ]);
  }

  buildBundle(options) {
    return Q.resolve().then(() => {
      const opts = bundleOpts(options);
      return this._bundler.bundle(
        opts.entryFile,
        opts.runModule,
        opts.sourceMapUrl,
        opts.dev,
        opts.platform
      );
    });
  }

  buildBundleFromUrl(reqUrl) {
    const options = this._getOptionsFromUrl(reqUrl);
    return this.buildBundle(options);
  }

  getDependencies(options) {
    return Q.resolve().then(() => {
      const opts = dependencyOpts(options);
      return this._bundler.getDependencies(
        opts.entryFile,
        opts.dev,
        opts.platform,
      );
    });
  }

  getOrderedDependencyPaths(options) {
    return Q.resolve().then(() => {
      const opts = dependencyOpts(options);
      return this._bundler.getOrderedDependencyPaths(opts);
    });
  }

  _getBundle(req) {
    const {bundleID, refresh, options} = this._getBundleOptions(req);
    if (refresh) {
      return this._refreshBundle(bundleID, options);
    }
    return this._bundles[bundleID] ||
      (this._bundles[bundleID] = this.buildBundle(options));
  }

  _getBundleOptions(req) {
    const options = this._getOptionsFromUrl(req.url);
    const refresh = steal(options, 'refresh');
    return {
      bundleID: JSON.stringify(options),
      refresh: refresh,
      options: options,
    };
  }

  _refreshBundle(bundleID, options) {
    const depGraph = this._bundler._resolver._depGraph;
    return this._bundles[bundleID] = depGraph.refreshModuleCache()
      .then(() => this.buildBundle(options));
  }

  _onFileChange(type, filepath, root) {
    const absPath = path.join(root, filepath);
    this._bundler.invalidateFile(absPath);
    // Make sure the file watcher event runs through the system before
    // we rebuild the bundles.
    this._debouncedFileChangeHandler(absPath);
  }

  _rebuildBundles() {
    const buildBundle = this.buildBundle.bind(this);
    const bundles = this._bundles;

    Object.keys(bundles).forEach(function(optionsJson) {
      const options = JSON.parse(optionsJson);
      // Wait for a previous build (if exists) to finish.
      bundles[optionsJson] = (bundles[optionsJson] || Q()).always(function() {
        // With finally promise callback we can't change the state of the promise
        // so we need to reassign the promise.
        bundles[optionsJson] = buildBundle(options).then(function(p) {
          // Make a throwaway call to getSource to cache the source string.
          p.getSource({
            inlineSourceMap: options.inlineSourceMap,
            minify: options.minify,
          });
          return p;
        });
      });
      return bundles[optionsJson];
    });
  }

  _informChangeWatchers() {
    const watchers = this._changeWatchers;
    const headers = {
      'Content-Type': 'application/json; charset=UTF-8',
    };

    watchers.forEach(function(w) {
      w.res.writeHead(205, headers);
      w.res.end(JSON.stringify({ changed: true }));
    });

    this._changeWatchers = [];
  }

  processRequest(req, res, next) {
    const urlObj = url.parse(req.url, true);
    var pathname = urlObj.pathname.slice(1);

    var endpoint = null;
    sync.each(SERVER_API, (handler, pattern) => {
      if (!endpoint && mm.isMatch(pathname, pattern)) {
        endpoint = handler;
      }
    })

    if (endpoint) {
      const requestEvent = Activity.startEvent('request:' + req.url);
      const finishResponse = res.end;
      res.end = (body) => {
        if (body == null) {
          body = '';
        }
        finishResponse.call(res, body);
        Activity.endEvent(requestEvent);
      };
      endpoint.call(this, req, res);
    } else {
      next();
    }
  }

  _handleError(res, bundleID, error) {
    res.writeHead(error.status || 500, {
      'Content-Type': 'application/json; charset=UTF-8',
    });

    if (error.type === 'TransformError' || error.type === 'NotFoundError') {
      error.errors = [{
        description: error.description,
        filename: error.filename,
        lineNumber: error.lineNumber,
      }];
      res.end(JSON.stringify(error));

      if (error.type === 'NotFoundError') {
        delete this._bundles[bundleID];
      }
    } else {
      console.error(error.stack || error);
      res.end(JSON.stringify({
        type: 'InternalError',
        message: 'react-packager has encountered an internal error, ' +
          'please check your terminal error output for more details',
      }));
    }
  }

  _getOptionsFromUrl(reqUrl) {
    // `true` to parse the query param as an object.
    const urlObj = url.parse(reqUrl, true);
    // node v0.11.14 bug see https://github.com/facebook/react-native/issues/218
    urlObj.query = urlObj.query || {};

    const pathname = decodeURIComponent(urlObj.pathname);

    const extensionRegex = /\.(bundle|map)$/;

    return {
      sourceMapUrl: pathname.replace(extensionRegex, '.map'),
      entryFile: 'js/src' + pathname.replace(extensionRegex, '.js'),
      dev: this._getBoolOptionFromQuery(urlObj.query, 'dev', true),
      minify: this._getBoolOptionFromQuery(urlObj.query, 'minify'),
      refresh: urlObj.query.refresh === '',
      runModule: this._getBoolOptionFromQuery(urlObj.query, 'runModule', true),
      inlineSourceMap: this._getBoolOptionFromQuery(
        urlObj.query,
        'inlineSourceMap',
        false
      ),
      platform: urlObj.query.platform,
    };
  }

  _getBoolOptionFromQuery(query, opt, defaultVal) {
    if (query[opt] == null && defaultVal != null) {
      return defaultVal;
    }

    return query[opt] === 'true' || query[opt] === '1';
  }
}

module.exports = Server;
