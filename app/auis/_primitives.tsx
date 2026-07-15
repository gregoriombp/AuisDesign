/**
 * Compatibility entrypoint for generated UX flows that live outside the
 * styleguide tree. New flows may import directly from `styleguide/_primitives`;
 * this re-export keeps older generated paths valid.
 */
export * from "./styleguide/_primitives"
