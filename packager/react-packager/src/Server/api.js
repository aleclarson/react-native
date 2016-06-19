/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const Promise = require('Promise');
const url = require('url');
const path = require('path');
const syncFs = require('io/sync');
const asyncFs = require('io/async');

const Activity = require('../Activity');

module.exports = {
  '*.bundle': readBundle,
  '*.map': readMap,
  '*.assets': readAssets,
  'read/**': readSpecificFile,
  'assets/**': readSpecificAsset,
  'watcher/**': processFileEvent,
  'onchange': onFileChange,
  'profile': dumpProfileInfo,
  'debug': debug,
  'debug/lastBundle': debugLastBundle,
  'debug/bundles': debugBundles,
  'debug/graph': debugGraph,
};

function readBundle(req, res) {
  return this.buildBundleFromUrl(req.url)
  .then(bundle => {
    const bundleSource = bundle.getSource({
      inlineSourceMap: false,
      minify: false
      // inlineSourceMap: options.inlineSourceMap,
      // minify: options.minify,
      // dev: options.dev,
    });

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('ETag', bundle.getEtag());

    if (req.headers['if-none-match'] === res.getHeader('ETag')){
      res.statusCode = 304;
      res.end();
    } else {
      res.end(bundleSource);
    }
  });
}

function readMap(req, res) {
  return this.buildBundleFromUrl(req.url)
  .then(bundle => {
    var sourceMap = bundle.getSourceMap({
      // minify: options.minify,
      // dev: options.dev,
    });
    if (typeof sourceMap !== 'string') {
      sourceMap = JSON.stringify(sourceMap);
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(sourceMap);
  });
}

function readAssets(req, res) {
  return this.buildBundleFromUrl(req.url)
  .then(bundle => {
    var assets = bundle.getAssets();
    assets = JSON.stringify(assets);
    res.setHeader('Content-Type', 'application/json');
    res.end(assets);
  });
}

function readSpecificFile(req, res) {
  const urlObj = url.parse(req.url, true);
  const filePath = urlObj.pathname.replace(/^\/read/, '');
  return asyncFs.read(filePath)
  .then(contents => res.end(contents))
  .fail(error => {
    res.writeHead(500);
    if (error.code === 'ENOENT') {
      res.end('"' + filePath + '" doesnt exist.');
    } else {
      res.end(error.message);
    }
  });
}

function readSpecificAsset(req, res) {
  const urlObj = url.parse(req.url, true);
  const assetPath = urlObj.pathname.match(/^\/assets\/(.+)$/);
  return this._assetServer
    .get(assetPath[1], urlObj.query.platform)
    .then(data =>
      res.end(data))
    .fail(error => {
      console.error(error.stack);
      res.writeHead('404');
      res.end('Asset not found');
    });
}

function processFileEvent(req, res) {

  const urlObj = url.parse(req.url, true);
  const event = urlObj.query.event;
  const force = urlObj.query.force === 'true';
  const absPath = urlObj.pathname.replace(/^\/watcher/, '');
  const fs = this._bundler._resolver._depGraph._fastfs;

  const file = fs._fastPaths[absPath];
  const fstat = file && event !== 'delete' && syncFs.stats(absPath);

  if (force || file || event === 'add') {
    const root = fs._getRoot(absPath);
    if (!root) {
      log.moat(1);
      log.white('Invalid root: ');
      log.red(absPath);
      log.moat(1);
    }

    // Only process events for files that aren't already handled by the packager.
    else if (this._fileWatcher._watcherByRoot[root.path] == null) {
      const relPath = path.relative(root.path, absPath);
      this._fileWatcher.emit('all', event, relPath, root.path, fstat);
    }
  }

  res.end();
}

function onFileChange(req, res) {
  const watchers = this._changeWatchers;
  watchers.push({
    req: req,
    res: res,
  });
  req.on('close', () => {
    for (let i = 0; i < watchers.length; i++) {
      if (watchers[i] && watchers[i].req === req) {
        watchers.splice(i, 1);
        break;
      }
    }
  });
}

function dumpProfileInfo(req, res) {
  console.log('Dumping profile information...');
  const dumpName = '/tmp/dump_' + Date.now() + '.json';
  const prefix = process.env.TRACE_VIEWER_PATH || '';
  const cmd = path.join(prefix, 'trace2html') + ' ' + dumpName;
  fs.writeFileSync(dumpName, req.rawBody);
  exec(cmd, error => {
    if (error) {
      if (error.code === 127) {
        console.error(
          '\n** Failed executing `' + cmd + '` **\n\n' +
          'Google trace-viewer is required to visualize the data, do you have it installled?\n\n' +
          'You can get it at:\n\n' +
          '  https://github.com/google/trace-viewer\n\n' +
          'If it\'s not in your path,  you can set a custom path with:\n\n' +
          '  TRACE_VIEWER_PATH=/path/to/trace-viewer\n\n' +
          'NOTE: Your profile data was kept at:\n\n' +
          '  ' + dumpName
        );
      } else {
        console.error('Unknown error', error);
      }
      res.end();
      return;
    } else {
      exec('rm ' + dumpName);
      exec('open ' + dumpName.replace(/json$/, 'html'), err => {
        if (err) {
          console.error(err);
        }
        res.end();
      });
    }
  });
}

function debug(req, res) {
  var ret = '<!doctype html>';
  ret += '<div><a href="/debug/bundles">Cached Bundles</a></div>';
  ret += '<div><a href="/debug/graph">Dependency Graph</a></div>';
  res.end(ret);
}

function debugLastBundle(req, res) {
  var ret = '<!doctype html>';
  ret += '<h1> Most Recent Bundle </h1>';
  const bundle = this._bundles[this._lastBundle];
  const options = JSON.parse(this._lastBundle);
  if (!bundle) {
    res.writeHead(404);
    res.end('No bundle found!');
    return;
  }
  return bundle.then(b => {
    return this._bundler.getDependencies(
      options.entryFile,
      options.dev,
      options.platform
    ).then(
      (resolved) => {
        var newline = '<br/>';
        Object.keys(resolved._mappings).forEach(hash => {
          var mappings = resolved._mappings[hash];
          ret += hash + newline;
          if (mappings.length === 0) {
            ret += 'No dependencies found!' + newline;
          } else {
            mappings.forEach(mapping => {
              ret += mapping[0] + newline;
              ret += mapping[1].path + newline;
              ret += newline;
            });
          }
          ret += newline;
        });
        res.end(ret);
      },
      e => {
        res.writeHead(500);
        res.end('Internal Error');
        console.log(e.stack);
      }
    );
  });
}

function debugBundles(req, res) {
  var ret = '<!doctype html>';
  ret += '<h1> Cached Bundles </h1>';
  Promise.all(
    Object.keys(this._bundles).map(hash => {
      return this._bundles[hash].then(p => {
        ret += '<div><h2>' + hash + '</h2>';
        ret += p.getDebugInfo();
      });
    })
  ).then(
    () => res.end(ret),
    e => {
      res.writeHead(500);
      res.end('Internal Error');
      console.log(e.stack);
    }
  );
}

function debugGraph(req, res) {
  var ret = '<!doctype html>';
  ret += '<h1> Dependency Graph </h2>';
  ret += this._bundler.getGraphDebugInfo();
  res.end(ret);
}
