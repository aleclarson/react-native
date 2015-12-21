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
const Bundle = require('../Bundler/Bundle');
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

const SUPPRESSED_EVENTS = /^\/(read|watcher)\//;

const validateOpts = declareOpts({
  projectRoots: {
    type: 'array',
    required: true,
  },
  projectExts: {
    type: 'array',
    required: true,
  },
  assetRoots: {
    type: 'array',
    required: true,
  },
  assetExts: {
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
  transformTimeoutInterval: {
    type: 'number',
    required: false,
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
    this._changeWatchers = [];

    const globsByRoot = Object.create(null);
    const projectGlobs = opts.projectExts.map(ext => '**/*.' + ext);
    opts.projectRoots
      .concat(opts.internalRoots)
      .forEach(dir => globsByRoot[dir] = projectGlobs);

    const assetGlobs = opts.assetExts.map(ext => '**/*.' + ext);
    opts.assetRoots.forEach(dir => {
      const globs = globsByRoot[dir];
      if (globs) {
        globsByRoot[dir] = globs.concat(assetGlobs);
      } else {
        globsByRoot[dir] = assetGlobs;
      }
    });

    const roots = Object.keys(globsByRoot).map(dir => {
      return {
        dir: dir,
        globs: globsByRoot[dir],
      };
    });

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
    const bundle = new Bundle(options);
    bundle._bundling = this._bundler.bundle(bundle);
    return bundle;
  }

  buildBundleFromUrl(reqUrl) {
    const options = this._getOptionsFromUrl(reqUrl);
    return this.buildBundle(options);
  }

  _getBundle(req) {
    const {bundleID, refresh, options} = this._getBundleOptions(req);
    if (refresh) {
      return this._refreshBundle(bundleID, options);
    }
    const bundle = this._bundles[bundleID] ||
      (this._bundles[bundleID] = this.buildBundle(options));
    return bundle._bundling;
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
    return depGraph.refreshModuleCache()
      .then(() => {
        const bundle = this.buildBundle(options);
        this._bundles[bundleID] = bundle;
        return bundle._bundling;
      });
  }

  _onFileChange(type, filepath, root) {
    const absPath = path.join(root, filepath);
    this._bundler.invalidateFile(absPath);
    // Make sure the file watcher event runs through the system before
    // we rebuild the bundles.
    this._debouncedFileChangeHandler(absPath);
  }

  _rebuildBundles(filePath) {
    const buildBundle = this.buildBundle.bind(this);
    const bundles = this._bundles;

    sync.each(bundles, (bundle, hash) => {
      const options = JSON.parse(hash);
      var bundle = bundles[hash];
      if (bundle) {
        bundle.abort();
        this._bundler.resetTransformer();
      }
      log
        .moat(1)
        .green('building bundle: ')
        .white(options.entryFile)
        .moat(1);
      bundle = buildBundle(options);
      bundles[hash] = bundle;
      bundle._bundling = bundle._bundling.then(function(p) {
        // Make a throwaway call to getSource to cache the source string.
        p.getSource({
          inlineSourceMap: options.inlineSourceMap,
          minify: options.minify,
        });
        return p;
      });
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
      var requestEvent = null;
      if (!SUPPRESSED_EVENTS.test(req.url)) {
        requestEvent = Activity.startEvent('request:' + req.url);
      }
      const finishResponse = res.end;
      res.end = (body) => {
        if (body == null) {
          body = '';
        }
        finishResponse.call(res, body);
        if (requestEvent) {
          Activity.endEvent(requestEvent);
        }
      };
      endpoint.call(this, req, res);
    } else {
      next();
    }
  }

  _fileExists(filePath) {
    var exists = false;
    sync.each(this._projectRoots, function(root) {
      if (!exists && sync.exists(root + '/' + filePath)) {
        exists = true;
      }
    });
    return exists;
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

    const dir = urlObj.query.dir || '';
    const platform = urlObj.query.platform || 'ios';

    const pathname = decodeURIComponent(urlObj.pathname)
      .slice(1).replace(/\.(bundle|map)$/, '');

    const entryFile = path.join(dir, pathname) + '.' + platform + '.js';
    const sourceMapUrl = '/' + pathname +
      '.map?platform=' + platform + '&dir=' + dir;

    return {
      platform: platform,
      entryFile: entryFile,
      sourceMapUrl: sourceMapUrl,
      dev: this._getBoolOptionFromQuery(urlObj.query, 'dev', true),
      minify: this._getBoolOptionFromQuery(urlObj.query, 'minify'),
      refresh: urlObj.query.refresh === '',
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
