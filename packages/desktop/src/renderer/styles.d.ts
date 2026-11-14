// esbuild bundles the stylesheet an entry imports; TypeScript only needs to
// know the import is allowed.
declare module "*.css";
