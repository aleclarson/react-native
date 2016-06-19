/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const File = require('./File');
const isDescendant = require('../../lib/isDescendant');

const Path = require('path');
const syncFs = require('io/sync');
const Promise = require('Promise');
const {EventEmitter} = require('events');

require('./lotusfs').initialize();

const NOT_FOUND_IN_ROOTS = 'NotFoundInRootsError';

class Fastfs extends EventEmitter {
  constructor(name, roots, fileWatcher, {ignore, crawling, activity}) {
    super();
    this._name = name;
    this._fileWatcher = fileWatcher;
    this._ignore = ignore;
    this._detachedRoots = [];
    this._roots = roots.map(root => new File(root, { isDir: true }));
    this._fastPaths = Object.create(null);
    this._crawling = crawling;
    this._activity = activity;
  }

  build() {
    return this._crawling.then(files => {
      let fastfsActivity;
      const activity = this._activity;
      if (activity) {
        fastfsActivity = activity.startEvent(this._name);
      }
      files.forEach(filePath => {
        if (!syncFs.isFile(filePath)) {
          debugger;
        }
        const newFile = new File(filePath, { isDir: false });
        const parent = this._fastPaths[Path.dirname(filePath)];
        if (parent) {
          parent.addChild(newFile);
        } else {
          this._add(newFile);
          for (let file = newFile; file; file = file.parent) {
            if (!this._fastPaths[file.path]) {
              this._fastPaths[file.path] = file;
            }
          }
        }
      });
      if (activity) {
        activity.endEvent(fastfsActivity);
      }
      this._fileWatcher.on('all', this._processFileChange.bind(this));
    });
  }

  stat(filePath) {
    return Promise().then(() => {
      const file = this._getFile(filePath);
      return file.stat();
    });
  }

  getAllFiles() {
    // one-level-deep flatten of files
    return [].concat(...this._roots.map(root => root.getFiles()));
  }

  findFilesByExt(ext, { ignore } = {}) {
    return this.findFilesByExts([ext], {ignore});
  }

  findFilesByExts(exts, { ignore } = {}) {
    return this.getAllFiles()
      .filter(file => (
        exts.indexOf(file.ext()) !== -1 && (!ignore || !ignore(file.path))
      ))
      .map(file => file.path);
  }

  findFilesByName(name, { ignore } = {}) {
    return this.getAllFiles()
      .filter(
        file => Path.basename(file.path) === name &&
          (!ignore || !ignore(file.path))
      )
      .map(file => file.path);
  }

  matchFilesByPattern(pattern) {
    return this.getAllFiles()
      .filter(file => file.path.match(pattern))
      .map(file => file.path);
  }

  readFile(filePath) {
    const file = this._getFile(filePath);
    if (!file) {
      throw new Error(`Unable to find file with path: ${filePath}`);
    }
    return file.read();
  }

  readWhile(filePath, predicate) {
    const file = this._getFile(filePath);
    if (!file) {
      throw new Error(`Unable to find file with path: ${filePath}`);
    }
    return file.readWhile(predicate);
  }

  closest(filePath, name) {
    for (let file = this._getFile(filePath).parent;
         file;
         file = file.parent) {
      if (file.children[name]) {
        return file.children[name].path;
      }
    }
    return null;
  }

  fileExists(filePath) {
    let file;
    try {
      file = this._getFile(filePath);
    } catch (e) {
      if (e.code === 404 || e.type === NOT_FOUND_IN_ROOTS) {
        return false;
      }
      throw e;
    }

    return file && !file.isDir;
  }

  dirExists(filePath) {
    let file;
    try {
      file = this._getFile(filePath);
    } catch (e) {
      if (e.code === 404 || e.type === NOT_FOUND_IN_ROOTS) {
        return false;
      }
      throw e;
    }

    return file && file.isDir;
  }

  matches(dir, pattern) {
    const dirFile = this._getFile(dir);
    if (!dirFile.isDir) {
      throw new Error(`Expected file ${dirFile.path} to be a directory`);
    }

    return Object.keys(dirFile.children)
      .filter(name => name.match(pattern))
      .map(name => Path.join(dirFile.path, name));
  }

  _getRoot(filePath) {
    return this._getRootFromRoots(filePath, this._roots) ||
           this._getRootFromRoots(filePath, this._detachedRoots);
  }

  _getRootFromRoots(filePath, roots) {
    for (let i = 0; i < roots.length; i++) {
      let root = roots[i];
      if (isDescendant(root.path, filePath)) {
        return root;
      }
    }
    return null;
  }

  _getAndAssertRoot(filePath) {
    const root = this._getRoot(filePath);
    if (!root) {
      const error = new Error(`File '${filePath}' not found in any of the roots`);
      error.type = NOT_FOUND_IN_ROOTS;
      throw error;
    }
    return root;
  }

  _getFile(filePath) {
    filePath = Path.normalize(filePath);
    var file = this._fastPaths[filePath];

    if (!file) {
      let root = this._getAndAssertRoot(filePath);

      // Ignored files are created on-the-fly.
      if (this._ignore(filePath)) {
        file = root._createFileFromPath(filePath);
      } else {
        try {
          file = root.getFileFromPath(filePath);
        } catch (error) {
          log.moat(1);
          log.red('Error: ');
          log.white(error.message);
          // log.moat(0);
          // log.gray.dim(error.stack.split(log.ln).slice(1).join(log.ln));
          log.moat(1);
        }
      }

      if (file) {
        this._fastPaths[filePath] = file;
      }
    }

    return file;
  }

  _add(file) {
    this._getAndAssertRoot(file.path).addChild(file);
  }

  // _didAbortFileEvent(absPath, reason) {
  //   log
  //     .moat(1)
  //     .red('File event aborted: ')
  //     .gray(absPath)
  //     .moat(0)
  //     .white(reason)
  //     .moat(1);
  // }

  _processFileChange(type, filePath, root, fstat) {

    if (fstat && fstat.isDirectory()) {
      return;
    }

    const absPath = Path.join(root, filePath);
    if (!this._getRoot(absPath)) {
      // this._didAbortFileEvent(absPath, 'This path has an invalid root!');
      return;
    }

    if (this._ignore(absPath)) {
      // this._didAbortFileEvent(absPath, 'This path is ignored by the packager!');
      return;
    }

    if (type === 'add') {
      try {
        const file = this._getFile(absPath);
      } catch(error) {
        if (error.code === 404) {
          return;
        }
        throw error;
      }
    } else {
      const file = this._fastPaths[absPath];
      if (file) {
        file.remove();
        delete this._fastPaths[absPath];
      }
    }

    const relPath = Path.relative(lotus.path, absPath);
    log.moat(1);
    if (type === 'delete') {
      log.white('File deleted: ');
      log.red(relPath);
    } else if (type === 'change') {
      log.white('File changed: ');
      log.green(relPath);
    } else if (type === 'add') {
      log.white('File added: ');
      log.cyan(relPath);
    }
    log.moat(1);

    if (type !== 'delete') {
      this._add(new File(absPath, { isDir: false }));
    }

    this.emit('change', type, filePath, root, fstat);
  }
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

module.exports = Fastfs;
