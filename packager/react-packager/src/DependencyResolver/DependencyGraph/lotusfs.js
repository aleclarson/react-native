
const lotus = require('lotus-require');
const File = require('./File');

exports.initialize = function() {
  if (lotus.hasOwnProperty('file')) { return }
  var file = null;
  Object.defineProperty(lotus, 'file', {
    enumerable: true,
    get: () => {
      if (file) { return file }
      file = new File(lotus.path, { isDir: true });
      file.isDetached = true;
      file.getFileFromPath = getFileFromPath;
      return file;
    }
  });
}

function getFileFromPath(filePath) {
  return this._getFileFromPath(filePath)
    || this._createFileFromPath(filePath);
}
