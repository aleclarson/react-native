
const path = require('path');

module.exports = function(root, child) {
  return path.relative(root, child).indexOf('..') !== 0;
};
