
require('babel-polyfill');

require(process.env.LOTUS_PATH + '/react-packager/env');

require('babel-register/only')(
  [ /react-native\/local-cli/ ],
  require('path').resolve(__dirname, '..', '.babelrc')
);
