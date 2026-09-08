const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const shims = {
  util: path.resolve(__dirname, 'metro-shims/util.js'),
  assert: path.resolve(__dirname, 'metro-shims/assert.js'),
  'node:util': path.resolve(__dirname, 'metro-shims/util.js'),
  'node:assert': path.resolve(__dirname, 'metro-shims/assert.js'),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (shims[moduleName]) {
    return { type: 'sourceFile', filePath: shims[moduleName] };
  }
  // Broken relative path inside the npm "util" package
  if (
    moduleName === './support/types' &&
    context.originModulePath &&
    context.originModulePath.replace(/\\/g, '/').includes('/util/')
  ) {
    return { type: 'sourceFile', filePath: path.resolve(__dirname, 'metro-shims/util.js') };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
