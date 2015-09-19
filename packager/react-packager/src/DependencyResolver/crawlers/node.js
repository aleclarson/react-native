'use strict';

const Q = require('q');
const debug = require('debug')('ReactNativePackager:DependencyGraph');
const fs = require('fs');
const path = require('path');

const readDir = Q.denodeify(fs.readdir);
const stat = Q.denodeify(fs.stat);

function nodeRecReadDir(roots, {ignore, exts}) {
  const queue = roots.slice();
  const retFiles = [];
  const extPattern = new RegExp(
    '\.(' + exts.join('|') + ')$'
  );

  function search() {
    const currDir = queue.shift();
    if (!currDir) {
      return Q();
    }

    return readDir(currDir)
      .then(files => files.map(f => path.join(currDir, f)))
      .then(files => Q.all(
        files.map(f => stat(f).fail(handleBrokenLink))
      ).then(stats => [
        // Remove broken links.
        files.filter((file, i) => !!stats[i]),
        stats.filter(Boolean),
      ]))
      .then(([files, stats]) => {
        files.forEach((filePath, i) => {
          if (ignore(filePath)) {
            return;
          }

          if (stats[i].isDirectory()) {
            queue.push(filePath);
            return;
          }

          if (filePath.match(extPattern)) {
            retFiles.push(filePath);
          }
        });

        return search();
      });
  }

  return search().then(() => retFiles);
}

function handleBrokenLink(e) {
  debug('WARNING: error stating, possibly broken symlink', e.message);
  return Q();
}

module.exports = nodeRecReadDir;
