const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Native build output and CocoaPods live inside the project (ios/, android/)
// but no JavaScript is ever imported from them. Without this, Metro crawls
// and watches them — tens of thousands of files, rewritten on every native
// build — which grew the dev server's memory until it crashed with "heap
// out of memory" after a few hours.
const NATIVE_BUILD_DIRS = [
  /[\\/]ios[\\/]build[\\/].*/,
  /[\\/]ios[\\/]Pods[\\/].*/,
  /[\\/]android[\\/]build[\\/].*/,
  /[\\/]android[\\/]app[\\/]build[\\/].*/,
  /[\\/]android[\\/]\.gradle[\\/].*/,
];
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  ...NATIVE_BUILD_DIRS,
];

module.exports = config;
