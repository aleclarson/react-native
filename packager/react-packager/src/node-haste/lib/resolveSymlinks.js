/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const path = require('path');
const fs = require('fs');

module.exports = function resolveSymlinks(lookupFolder) {
  const resolvedSymlinks = [];

  fs.readdirSync(lookupFolder).forEach(folder => {
    const visited = [];

    let symlink = path.resolve(lookupFolder, folder);
    while (fs.lstatSync(symlink).isSymbolicLink()) {
      const index = visited.indexOf(symlink);
      if (index !== -1) {
        throw Error(
          `Infinite symlink recursion detected:\n  ` +
            visited.slice(index).join(`\n  `)
        );
      }

      visited.push(symlink);
      symlink = path.resolve(
        path.dirname(symlink),
        fs.readlinkSync(symlink)
      );
    }

    if (visited.length) {
      resolvedSymlinks.push(symlink);
    }
  });

  return resolvedSymlinks;
};
