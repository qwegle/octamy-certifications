const { withAppBuildGradle } = require("expo/config-plugins");

const SIGNING_VALUES = `
def octamyUploadStoreFile = System.getenv("OCTAMY_UPLOAD_STORE_FILE") ?: findProperty("OCTAMY_UPLOAD_STORE_FILE")
def octamyUploadStorePassword = System.getenv("OCTAMY_UPLOAD_STORE_PASSWORD") ?: findProperty("OCTAMY_UPLOAD_STORE_PASSWORD")
def octamyUploadKeyAlias = System.getenv("OCTAMY_UPLOAD_KEY_ALIAS") ?: findProperty("OCTAMY_UPLOAD_KEY_ALIAS")
def octamyUploadKeyPassword = System.getenv("OCTAMY_UPLOAD_KEY_PASSWORD") ?: findProperty("OCTAMY_UPLOAD_KEY_PASSWORD")
def octamyReleaseSigningConfigured = [
    octamyUploadStoreFile,
    octamyUploadStorePassword,
    octamyUploadKeyAlias,
    octamyUploadKeyPassword
].every { it != null && it.toString().trim() }
`;

const RELEASE_SIGNING_CONFIG = `
        release {
            if (octamyReleaseSigningConfigured) {
                storeFile file(octamyUploadStoreFile)
                storePassword octamyUploadStorePassword
                keyAlias octamyUploadKeyAlias
                keyPassword octamyUploadKeyPassword
            }
        }
`;

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("Octamy Android release signing requires a Groovy app build.gradle.");
    }

    let contents = gradleConfig.modResults.contents;
    if (!contents.includes("octamyReleaseSigningConfigured")) {
      contents = contents.replace("\nandroid {\n", `${SIGNING_VALUES}\nandroid {\n`);
      contents = contents.replace(
        /(\n    signingConfigs \{\n        debug \{[\s\S]*?\n        \}\n)(    \})/,
        `$1${RELEASE_SIGNING_CONFIG}$2`,
      );
      contents = contents.replace(
        /(\n        release \{\n[\s\S]*?)            signingConfig signingConfigs\.debug/,
        "$1            signingConfig octamyReleaseSigningConfigured ? signingConfigs.release : null",
      );
    }

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
}

module.exports = withAndroidReleaseSigning;
