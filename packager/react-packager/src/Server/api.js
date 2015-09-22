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
const url = require('url');
const path = require('path');
const {sync, async} = require('io');

module.exports = {
  '*.bundle': readBundle,
  '*.map': readMap,
  '*.assets': readAssets,
  'assets/**': readSpecificAsset,
  'onchange': onFileChange,
  'profile': dumpProfileInfo,
  'debug': debug,
  'debug/bundles': debugBundles,
  'debug/graph': debugGraph,
};

function readBundle(req, res) {
  this._getBundle(req)
  .then(bundle => {
    const code = bundle.getSource({
      inlineSourceMap: false,
      minify: false
    });
    res.setHeader('Content-Type', 'application/javascript');
    res.end(code);
  })
  .fail(error => {
    const {bundleID} = this._getBundleOptions(req);
    this._handleError(res, bundleID, error);
  });
}

function readMap(req, res) {
  this._getBundle(req)
  .then(bundle => {
    var sourceMap = bundle.getSourceMap();
    sourceMap = JSON.stringify(sourceMap);
    res.setHeader('Content-Type', 'application/json');
    res.end(sourceMap);
  })
  .fail(error => {
    const {bundleID} = this._getBundleOptions(req);
    this._handleError(res, bundleID, error);
  });
}

function readAssets(req, res) {
  this._getBundle(req)
  .then(bundle => {
    var assets = bundle.getAssets();
    assets = JSON.stringify(assets);
    res.setHeader('Content-Type', 'application/json');
    res.end(assets);
  })
  .fail(error => {
    const {bundleID} = this._getBundleOptions(req);
    this._handleError(res, bundleID, error);
  });
}

function readSpecificAsset(req, res) {
  const urlObj = url.parse(req.url, true);
  const assetPath = urlObj.pathname.match(/^\/assets\/(.+)$/);
  const assetEvent = Activity.startEvent(`processing asset request ${assetPath[1]}`);
  this._assetServer.get(assetPath[1], urlObj.query.platform)
    .then(
      data => res.end(data),
      error => {
        console.error(error.stack);
        res.writeHead('404');
        res.end('Asset not found');
      }
    ).done(() => Activity.endEvent(assetEvent));
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

function debugBundles(req, res) {
  var ret = '<!doctype html>';
  ret += '<h1> Cached Bundles </h1>';
  Q.all(Object.keys(this._bundles).map(optionsJson =>
    this._bundles[optionsJson].then(p => {
      ret += '<div><h2>' + optionsJson + '</h2>';
      ret += p.getDebugInfo();
    })
  )).then(
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
