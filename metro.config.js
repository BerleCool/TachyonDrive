const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("glb", "gltf", "bin");
// Three r187's CommonJS entry invokes Node's process.emitWarning, which
// Hermes does not provide. Fiber's native build uses require("three"), so
// route both it and our imports to the same browser-compatible ES module.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three" && (platform === "android" || platform === "ios")) {
    return {
      type: "sourceFile",
      filePath: path.join(path.dirname(require.resolve("three")), "three.module.js"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
