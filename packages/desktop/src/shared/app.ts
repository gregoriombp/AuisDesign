// The app's identity. Both values are frozen from W0 on: Electron derives the
// userData folder from the product name, and the updater ties update continuity
// to the bundle id. Changing either later orphans every installed copy's project
// list and breaks its updates.

export const PRODUCT_NAME = "Auis Design";
export const APP_ID = "design.auis.desktop";

/** Where Help sends people: the project's public repository. */
export const HELP_URL = "https://github.com/gregoriombp/AuisDesign";
