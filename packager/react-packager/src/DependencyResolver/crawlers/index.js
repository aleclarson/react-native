'use strict';

const Promise = require('Promise');

const nodeCrawl = require('./node');
const watchmanCrawl = require('./watchman');

function crawl(roots, options) {

  const {fileWatcher} = options;

  return Promise.try(() =>
    fileWatcher.isWatchman())

  .then(isWatchman => {
    if (!isWatchman) {
      return false;
    }

    // Make sure we're dealing with a version of watchman
    // that's using `watch-project`
    // TODO(amasad): properly expose (and document) used sane internals.
    return Promise.try(() =>
      fileWatcher.getWatchers()
      .then(([watcher]) => !!watcher.watchProjectInfo.root)
    );
  })

  .then(isWatchman =>
    isWatchman ? watchmanCrawl(roots, options) : nodeCrawl(roots, options));
}

module.exports = crawl;
