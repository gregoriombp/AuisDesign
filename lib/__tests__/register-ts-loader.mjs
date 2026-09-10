// Registers the `.ts` extension resolver as a module hook so `node --test` can
// run the TypeScript unit tests with Node's built-in type stripping:
//   node --import ./lib/__tests__/register-ts-loader.mjs --test <files>
import { register } from "node:module"

register("./ts-extension-loader.mjs", import.meta.url)
