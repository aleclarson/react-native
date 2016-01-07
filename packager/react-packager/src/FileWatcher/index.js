/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const EventEmitter  = require('events').EventEmitter;
const sane = require('sane');
const Q = require('q');
const exec = require('child_process').exec;
const _ = require('underscore');

const MAX_WAIT_TIME = 25000;

// TODO(amasad): can we use watchman version command instead?r
const detectingWatcherClass = Q.promise(function(resolve) {
  exec('which watchman', function(err, out) {
    if (err || out.length === 0) {
      resolve(sane.NodeWatcher);
    } else {
      resolve(sane.WatchmanWatcher);
    }
  });
});

let inited = false;

class FileWatcher extends EventEmitter {

  constructor(rootConfigs) {
    if (inited) {
      throw new Error('FileWatcher can only be instantiated once');
    }
    inited = true;

    super();
    this._watcherByRoot = Object.create(null);

    log
      .moat(1)
      .format(rootConfigs, "FileWatcher.options = ")
      .moat(1);

    this._loading = Q.all(
      rootConfigs.map(createWatcher)
    ).then(watchers => {
      watchers.forEach((watcher, i) => {
        this._watcherByRoot[rootConfigs[i].dir] = watcher;
        watcher.on(
          'all',
          // args = (type, filePath, root, stat)
          (...args) => this.emit('all', ...args)
        );
      });
      return watchers;
    });

    this._loading.done();
  }

  getWatchers() {
    return this._loading;
  }

  getWatcherForRoot(root) {
    return this._loading.then(() => this._watcherByRoot[root]);
  }

  isWatchman() {
    return detectingWatcherClass.then(
      Watcher => Watcher === sane.WatchmanWatcher
    );
  }

  end() {
    return this._loading.then(
      (watchers) => watchers.map(
        watcher => Q.denodeify(watcher.close).call(watcher)
      )
    );
  }

  static createDummyWatcher() {
    const ev = new EventEmitter();
    _.extend(ev, {
      isWatchman: () => Q(false),
      end: () => Q(),
    });

    return ev;
  }
}

function createWatcher(rootConfig) {
  return detectingWatcherClass.then(function(Watcher) {
    const watcher = new Watcher(rootConfig.dir, {
      glob: rootConfig.globs,
      dot: false,
    });

    return Q.promise(function(resolve, reject) {
      const rejectTimeout = setTimeout(function() {
        reject(new Error([
          'Watcher took too long to load',
          'Try running `watchman version` from your terminal',
          'https://facebook.github.io/watchman/docs/troubleshooting.html',
        ].join('\n')));
      }, MAX_WAIT_TIME);

      watcher.once('ready', function() {
        clearTimeout(rejectTimeout);
        resolve(watcher);
      });
    });
  });
}

module.exports = FileWatcher;
