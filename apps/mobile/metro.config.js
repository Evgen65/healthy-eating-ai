const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// packages/shared uses Node ESM-style imports such as:
// export * from "./user.js"
// while the source file is user.ts.
//
// TypeScript/Vite/Node handle this convention, but Metro needs a small
// compatibility resolver for the shared source package.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(
        context,
        moduleName.slice(0, -3),
        platform
      );
    } catch {
      // No TS/TSX counterpart — resolve the original .js request normally.
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;