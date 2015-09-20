
const {sync} = require('io');
const path = require('path');
const File = require('./File');

var LOTUS_FILE = null;

Object.defineProperty(lotus, 'file', {
  enumerable: true,
  get: () => {
    var file = LOTUS_FILE;
    if (file) { return file }
    file = new File(lotus.path, { isDir: true });
    file.getFileFromPath = getFileFromPath;
    return LOTUS_FILE = file;
  }
});

function getFileFromPath(filePath) {
  return this._getFileFromPath(filePath)
    || this._createFileFromPath(filePath);
}
