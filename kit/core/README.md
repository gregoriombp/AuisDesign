# @auis/core

The domain the [Auis](https://github.com/gregoriombp/AuisDesign) Review Bridge's
server and chrome share: the comment types (schema v3), the agents and their
runtime settings, the `@mention` / `/skill` parser, reviewer handles, and the
DOM anchoring that keeps a pin on its element. No dependencies, no Node
built-ins, no React — the browser and the server import the same code.

You rarely install it yourself: [`@auis/next`](https://www.npmjs.com/package/@auis/next)
brings it. MIT.
