/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ImageSource
 * @flow
 */
'use strict';

const {ImageViewManager} = require('NativeModules');

class ImageSource {
  constructor(sizes) {
    this.sizes = sizes.sort(compareWidths);
  }

  get(width) {
    const {length} = this.sizes;
    for (let i = 0; i < length; i++) {
      const size = this.sizes[i];
      if (size.width >= width) {
        return size;
      }
    }
    // Use widest size by default.
    return this.sizes[length - 1];
  }

  prefetch(width) {
    const {uri} = this.get(width);
    return ImageViewManager.prefetchImage(uri);
  }
}

function compareWidths(a, b) {
  return a.width > b.width ? 1 : -1;
}

module.exports = ImageSource;
