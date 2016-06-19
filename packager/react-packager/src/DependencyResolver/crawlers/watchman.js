'use strict';

const isDescendant = require('../../lib/isDescendant');
const Promise = require('Promise');
const path = require('path');

function watchmanRecReadDir(roots, {ignore, fileWatcher, exts}) {
  const files = [];
  return Promise.map(roots, root => {
    return fileWatcher.getWatcherForRoot(root);
  })
  .then(watchers => {
    // All watchman roots for all watches we have.
    const watchmanRoots = watchers.map(watcher => {
      return watcher.watchProjectInfo.root;
    });

    // Actual unique watchers (because we use watch-project we may end up with
    // duplicate "real" watches, and that's by design).
    // TODO(amasad): push this functionality into the `FileWatcher`.
    const uniqueWatchers = watchers.filter((watcher, i) => {
      return watchmanRoots.indexOf(watcher.watchProjectInfo.root) === i;
    });

    return Promise.map(uniqueWatchers, watcher => {
      const watchedRoot = watcher.watchProjectInfo.root;

      // Build up an expression to filter the output by the relevant roots.
      const dirExpr = ['anyof'];
      for (let i = 0; i < roots.length; i++) {
        const root = roots[i];
        if (isDescendant(watchedRoot, root)) {
          dirExpr.push(['dirname', path.relative(watchedRoot, root)]);
        }
      }

      const cmd = Promise.ify(watcher.client.command.bind(watcher.client));
      return cmd(['query', watchedRoot, {
        'suffix': exts,
        'expression': ['allof', ['type', 'f'], 'exists', dirExpr],
        'fields': ['name'],
      }])
      .then(resp => {
        if ('warning' in resp) {
          console.warn('watchman warning: ', resp.warning);
        }

        resp.files.forEach(filePath => {
          filePath = path.join(
            watchedRoot,
            filePath
          );

          if (!ignore(filePath)) {
            files.push(filePath);
          }
          return false;
        });
      });
    });
  })
  .then(() => files);
}

module.exports = watchmanRecReadDir;
