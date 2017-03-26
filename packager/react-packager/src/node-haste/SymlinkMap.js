/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const resolveSymlink = require('resolve-symlink');

class SymlinkMap {

  constructor({
    roots,
    extensions,
    fastfs,
    fileWatcher,
    ignoreFilePath,
    createHasteMap,
  }) {
    this._map = Object.create(null);       // keys are symlink paths, values are resolved paths
    this._links = Object.create(null);     // keys are resolved paths, values are arrays of symlink paths
    this._crawlers = Object.create(null);  // keys are root paths, values are HasteMap build promises
    this._crawlerQueue = [];
    this._crawling = null;

    this._roots = roots;
    this._extensions = extensions;
    this._fastfs = fastfs;
    this._fileWatcher = fileWatcher;
    this._ignoreFilePath = ignoreFilePath;
    this._createHasteMap = createHasteMap;

    this._build();
  }

  // 1. If `filePath` is a symlink, resolve it.
  // 2. Crawl the root of `filePath`, if necessary.
  // 3. Return the resolved path.
  resolve(filePath) {

    // Try resolving `filePath` as a symlink.
    const file = this._map[filePath];
    if (file) {
      filePath = file.path;
    }

    const root = this._fastfs._getRoot(filePath);
    if (this._links[root.path]) {
      return this.crawl(root.path)
        .then(() => filePath);
    }

    // Do nothing if not a linked root.
    return Promise.resolve(filePath);
  }

  crawl(rootPath) {
    let crawler = this._crawlers[rootPath];
    if (crawler) {
      return crawler.promise;
    }

    crawler = Promise.defer();
    this._crawlers[rootPath] = crawler;

    if (this._crawling) {
      this._crawlerQueue.push(rootPath);
    } else {
      this._crawl(rootPath);
    }

    return crawler.promise;
  }

  _build() {
    const fastfs = this._fastfs;

    // 1. Resolve symlinks in every 'node_modules' directory.
    const resolvedLinks = resolveSymlinks(
      this._roots,
      this._ignoreFilePath,
    );

    // 2. Register each initial root with FastFS.
    this._roots.forEach(rootPath => {
      this._crawlers[rootPath] = Promise.resolve();
      addPackage(rootPath, fastfs);
    });

    // 3. Register each new root with FastFS.
    const roots = Object.create(null);
    Object.keys(resolvedLinks).forEach(rootPath => {
      roots[rootPath] = fastfs.addRoot(rootPath);
      addPackage(rootPath, fastfs);
    });

    // 4. Add each resolved symlink dependency to FastFS.
    Object.keys(roots).forEach(rootPath => {
      const root = roots[rootPath];
      const linkPaths = resolvedLinks[rootPath];
      linkPaths.forEach(linkPath => {
        this._map[linkPath] = root;
        fastfs.setFile(linkPath, root);
      });
      this._links[rootPath] = linkPaths;
    });

    fastfs.on('change', this._processFileChange.bind(this));
  }

  _crawl(rootPath) {
    this._crawling = rootPath;
    return this._createHasteMap({
      roots: [rootPath],
      extensions: this._extensions,
    })
    .build()
    .then(hasteMap => {
      const fastfs = this._fastfs;
      const hasteFiles = hasteMap.hasteFS.getAllFiles();
      hasteFiles.forEach(filePath => {
        if (fastfs._fastPaths[filePath] == null) {
          fastfs.addFile(filePath);
        }
      });

      this._fileWatcher.addWatcher({
        dir: rootPath,
        globs: this._extensions.map(ext => '**/*.' + ext),
      });

      this._crawlers[rootPath].resolve();

      if (this._crawlerQueue.length) {
        this._crawl(this._crawlerQueue.shift());
      } else {
        this._crawling = null;
      }
    });
  }

  // TODO: Handle addition + deletion of symlinks (and their resolved paths).
  _processFileChange(type, filePath, root) {
    const absPath = path.join(root, filePath);
    const linkPaths = this._links[absPath];
    if (!linkPaths) {
      return;
    }
    console.log('[SymlinkMap] ' + type + ': ' + absPath);
    const fastfs = this._fastfs;
    if (type !== 'delete') {
      const root = fastfs.getFile(absPath);
      linkPaths.forEach(linkPath => {
        this._map[linkPath] = root;
        fastfs.setFile(linkPath, root);
      });
    } else {
      linkPaths.forEach(linkPath => {
        fastfs.setFile(linkPath, null);
        delete this._map[linkPath];
      });
      delete this._links[resolvedPath];
    }
  }
}

module.exports = SymlinkMap;

function addPackage(rootPath, fastfs) {

  // Since we lazily crawl symlink dependencies, we need to add each
  // 'package.json' to FastFS manually (so the HasteMap can use them).
  const rootPkg = path.join(rootPath, 'package.json');
  if (fastfs._fastPaths[rootPkg] == null) {
    fastfs.addFile(rootPkg);
  }

  // Since 'jest-haste-map' ignores node_modules, we need to add
  // them to FastFS manually (in case any symlinks exist inside).
  const rootDeps = path.join(rootPath, 'node_modules');
  if (fs.existsSync(rootDeps)) {
    fastfs.addFile(rootDeps, true);
  }
}

// For each root, search the "node_modules" directory for any symlinks.
// Returns a map of resolved symlinks -- shaped like `map[rootPath][linkPath] = resolvedPath`
function resolveSymlinks(roots, ignoreFilePath) {
  const resolvedLinks = Object.create(null);

  roots.forEach(function gatherLinks(root) {
    const rootDeps = path.join(root, 'node_modules');
    if (!fs.existsSync(rootDeps)) {
      return;
    }

    fs.readdirSync(rootDeps).forEach(child => {
      const linkPath = path.join(rootDeps, child);
      if (!fs.lstatSync(linkPath).isSymbolicLink()) {
        return;
      }

      const root = resolveSymlink(linkPath);
      if (ignoreFilePath(root)) {
        return;
      }

      const linkPaths = resolvedLinks[root];
      if (linkPaths) {
        linkPaths.push(linkPath);
      } else {
        resolvedLinks[root] = [linkPath];
        gatherLinks(root);
      }
    });
  });

  return resolvedLinks;
}
