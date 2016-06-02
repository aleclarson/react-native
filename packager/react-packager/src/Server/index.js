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
const _ = require('underscore');
const mm = require('micromatch');
const url = require('url');
const has = require('has');
const sync = require('sync');
const path = require('path');
const steal = require ('steal');

const Bundle = require('../Bundler/Bundle');
const Bundler = require('../Bundler');
const Activity = require('../Activity');
const SERVER_API = require('./api');
const AssetServer = require('../AssetServer');
const declareOpts = require('../lib/declareOpts');
const FileWatcher = require('../DependencyResolver/FileWatcher');
const getPlatformExtension = require('../DependencyResolver/lib/getPlatformExtension');

const validateOpts = declareOpts({
  projectRoots: {
    type: 'array',
    required: true,
  },
  projectExts: {
    type: 'array',
    required: true,
  },
  assetExts: {
    type: 'array',
    default: [],
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
  transformTimeoutInterval: {
    type: 'number',
    required: false,
  },
  getTransformOptionsModulePath: {
    type: 'string',
    required: false,
  },
  disableInternalTransforms: {
    type: 'boolean',
    default: false,
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
  },
  runBeforeMainModule: {
    type: 'array',
    default: [
      // Ensures essential globals are available and are patched correctly.
      'InitializeJavaScriptAppEngine'
    ],
  },
  refresh: {
    type: 'boolean',
    default: false,
  },
  unbundle: {
    type: 'boolean',
    default: false,
  },
  hot: {
    type: 'boolean',
    default: false,
  },
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
    this._lastBundle = null;
    this._changeWatchers = [];
    this._fileChangeListeners = [];

    const globs = opts.projectExts.map(ext => '**/*.' + ext);
    const roots = opts.projectRoots
      .concat(opts.internalRoots)
      .map(dir => ({ dir, globs }));

    this._fileWatcher = options.nonPersistent
      ? FileWatcher.createDummyWatcher()
      : new FileWatcher(roots);

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
      const onFileChange = () => {
        // this._rebuildBundles(filePath);
        this._bundles = Object.create(null);
        this._informChangeWatchers();
      };

      // if Hot Loading is enabled avoid rebuilding bundles and sending live
      // updates. Instead, send the HMR updates right away and once that
      // finishes, invoke any other file change listener.
      if (this._hmrFileChangeListener) {
        this._hmrFileChangeListener(
          filePath,
          this._bundler.stat(filePath),
        ).then(onFileChange).done();
        return;
      }

      onFileChange();
    }, 50);

    log.moat(1);
    log.white('Watching roots: ');
    log.moat(0);
    log.plusIndent(2);
    opts.projectRoots.forEach(root => {
      log.yellow(root)
      log.moat(0)
    });
    opts.internalRoots.forEach(root => {
      log.gray(root)
      log.moat(0)
    });
    log.popIndent();

    log.moat(1);
    log.white('Watching extensions: ');
    log.moat(0);
    log.plusIndent(2);
    opts.projectExts.forEach(ext => {
      log.yellow(ext)
      log.moat(0)
    });
    opts.assetExts.forEach(ext => {
      log.cyan(ext)
      log.moat(0)
    });
    log.popIndent();
  }

  end() {
    Q.all([
      this._fileWatcher.end(),
      this._bundler.kill(),
    ]);
  }

  setHMRFileChangeListener(listener) {
    this._hmrFileChangeListener = listener;
  }

  buildBundle(options) {
    return Q.try(() => {
      if (!options.platform) {
        options.platform = getPlatformExtension(options.entryFile);
      }

      const opts = bundleOpts(options);
      return this._bundler.bundle(opts);
    });
  }

  buildPrepackBundle(options) {
    return Q.try(() => {
      if (!options.platform) {
        options.platform = getPlatformExtension(options.entryFile);
      }

      const opts = bundleOpts(options);
      return this._bundler.prepackBundle(opts);
    });
  }

  buildBundleFromUrl(reqUrl) {

    log.moat(1);
    log.yellow(reqUrl);
    log.moat(1);

    const options = this._getOptionsFromUrl(reqUrl);
    const refresh = steal(options, 'refresh');
    const hash = JSON.stringify(options);

    if (refresh) {
      log.moat(1);
      log.white('Refreshing module cache!');
      log.moat(1);
      this._bundler.refreshModuleCache();
      this._bundles[hash] = null;
    }

    if (!this._bundles[hash]) {
      this._lastBundle = hash;
      this._bundles[hash] = this.buildBundle(options);
    }

    return this._bundles[hash];
  }

  buildBundleForHMR(modules) {
    return this._bundler.bundleForHMR(modules);
  }

  getShallowDependencies(entryFile) {
    return this._bundler.getShallowDependencies(entryFile);
  }

  getModuleForPath(entryFile) {
    return this._bundler.getModuleForPath(entryFile);
  }

  getDependencies(options) {
    return Q.try(() => {
      if (!options.platform) {
        options.platform = getPlatformExtension(options.entryFile);
      }

      const opts = dependencyOpts(options);
      return this._bundler.getDependencies(
        opts.entryFile,
        opts.dev,
        opts.platform,
      );
    });
  }

  getOrderedDependencyPaths(options) {
    return Q.try(() => {
      const opts = dependencyOpts(options);
      return this._bundler.getOrderedDependencyPaths(opts);
    });
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

    Object.keys(bundles).forEach(hash => {

      const options = JSON.parse(hash);
      const buildBundle = () => {
        log.moat(1);
        log.format(options, { label: 'Rebuilding bundle: ', unlimited: true });
        log.moat(1);
        return this.buildBundle(options).then(bundle => {
          // Make a throwaway call to getSource to cache the source string.
          bundle.getSource({
            inlineSourceMap: options.inlineSourceMap,
            minify: options.minify,
            dev: options.dev,
          });
          return bundle;
        });
      };

      this._lastBundle = hash;

      // Wait for a previous build (if exists) to finish.
      return bundles[hash] = (bundles[hash] || Q())
        .then(buildBundle, buildBundle);
    });
  }

  _informChangeWatchers() {
    const watchers = this._changeWatchers;
    const headers = {
      'Content-Type': 'application/json; charset=UTF-8',
    };

    watchers.forEach(w => {
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
      const finishResponse = res.end;
      res.end = (body) => {
        if (body == null) {
          body = '';
        }
        finishResponse.call(res, body);
      };

      Q.try(() => endpoint.call(this, req, res))
        .fail(error => this._handleError(res, error))
        .done();
    } else {
      next();
    }
  }

  _handleError(res, error) {
    res.writeHead(error.status || 500, {
      'Content-Type': 'application/json; charset=UTF-8',
    });

    if (error.type === 'TransformError' ||
        error.type === 'NotFoundError' ||
        error.type === 'UnableToResolveError') {
      error.errors = [{
        description: error.description,
        filename: error.filename,
        lineNumber: error.lineNumber,
      }];
      res.end(JSON.stringify(error));
    } else {
      log.moat(1);
      log.white(error.stack);
      log.moat(1);
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

    const dir = urlObj.query.dir || '';

    const pathname = decodeURIComponent(urlObj.pathname)
      .slice(1).replace(/\.(bundle|map)$/, '');

    // try to get the platform from the url
    const platform = urlObj.query.platform ||
      getPlatformExtension(pathname);

    const entryFile = path.join(dir, pathname) + '.' + platform + '.js';
    const sourceMapUrl = '/' + pathname + '.map' + reqUrl.slice(reqUrl.indexOf('?'));

    return {
      platform,
      entryFile,
      sourceMapUrl,
      refresh: urlObj.query.refresh === '',
      dev: this._getBoolOptionFromQuery(urlObj.query, 'dev', true),
      minify: this._getBoolOptionFromQuery(urlObj.query, 'minify'),
      hot: this._getBoolOptionFromQuery(urlObj.query, 'hot', false),
      runModule: this._getBoolOptionFromQuery(urlObj.query, 'runModule', true),
      inlineSourceMap: this._getBoolOptionFromQuery(
        urlObj.query,
        'inlineSourceMap',
        false
      ),
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
