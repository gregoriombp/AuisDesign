// Local Apple Silicon test build. The identity is frozen in src/shared/app.ts.
// Public distribution (Developer ID, notarization, updates) is a later gate.
const config = {
  appId: "design.auis.desktop",
  productName: "Auis Design",
  directories: { output: "release", buildResources: "resources" },
  files: ["dist/**", "package.json", "!dist/**/*.map"],
  asar: true,
  npmRebuild: false,
  publish: null,
  artifactName: "Auis-Design-${version}-${arch}.${ext}",
  mac: {
    target: [{ target: "dmg", arch: ["arm64"] }],
    category: "public.app-category.developer-tools",
    icon: "../../app/icon.svg",
    identity: "-",
    hardenedRuntime: true,
    entitlements: "resources/entitlements.mac.plist",
    entitlementsInherit: "resources/entitlements.mac.plist",
    notarize: false,
    extendInfo: {
      NSMicrophoneUsageDescription:
        "A project open in Auis Design can use your microphone for voice input when you request it.",
      NSCameraUsageDescription:
        "A project open in Auis Design can use your camera when you request it.",
    },
  },
  dmg: {
    title: "Auis Design",
    contents: [
      { x: 130, y: 200, type: "file" },
      { x: 410, y: 200, type: "link", path: "/Applications" },
    ],
  },
};

export default config;
