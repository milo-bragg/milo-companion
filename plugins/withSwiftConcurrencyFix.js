const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Adds a post_install hook to the Podfile that sets
 * SWIFT_STRICT_CONCURRENCY=minimal for all pods,
 * preventing Swift 6 strict concurrency errors on Xcode 16+.
 */
const withSwiftConcurrencyFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfileContents = fs.readFileSync(podfilePath, "utf-8");

      const hook = `
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
    end
  end
end
`;

      if (!podfileContents.includes("SWIFT_STRICT_CONCURRENCY")) {
        podfileContents += hook;
        fs.writeFileSync(podfilePath, podfileContents);
      }

      return config;
    },
  ]);
};

module.exports = withSwiftConcurrencyFix;
