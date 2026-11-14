import { build } from "esbuild"
import fs from "node:fs/promises"
import path from "node:path"
import { zipSync } from "fflate"
import { finish } from "../../ui/scripts/build-css.mjs"
import postcss from "postcss"
const dir = path.resolve(import.meta.dirname, "..")
const root = path.resolve(dir, "../..")
const dist = path.join(dir, "dist")
await fs.rm(dist, { recursive: true, force: true })
await fs.mkdir(dist, { recursive: true })
await build({ entryPoints: ["content.tsx", "background.ts", "library.tsx", "export.tsx"].map(f => path.join(dir, "src", f)), outdir: dist, bundle: true, format: "iife", platform: "browser", target: "chrome116", minify: true, legalComments: "eof", loader: { ".css": "text" }, tsconfig: path.join(root, "tsconfig.json"), define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "scope-extension-css", setup(build) {
  build.onLoad({ filter: /extension\.css$/ }, async args => ({ contents: finish(await fs.readFile(args.path, "utf8")), loader: "text" }))
  build.onLoad({ filter: /chrome\.css$/ }, async args => {
    const css = postcss.parse(await fs.readFile(args.path, "utf8"))
    // Chromium does not register @property inside a shadow root. Materialize
    // Tailwind's existing fallback defaults there too, otherwise border/ring/
    // transform utilities silently vanish even though the same component works
    // in the host app. This does not create or alter design-system tokens.
    const defaults = []
    css.walkAtRules("supports", at => at.walkRules(rule => {
      if (rule.nodes?.some(n => n.type === "decl" && n.prop === "--auis-tw-border-style")) defaults.push(rule.clone())
    }))
    css.prepend(...defaults)
    return { contents: css.toString(), loader: "text" }
  })
} }], logOverride: { "ignored-bare-import": "silent" } })
await fs.copyFile(path.join(dir, "manifest.json"), path.join(dist, "manifest.json"))
await fs.cp(path.join(dir, "assets"), dist, { recursive: true })
await fs.writeFile(path.join(dist, "LEIA-ME.txt"), "AuisRewiew\n\nAbra chrome://extensions, ative Modo do desenvolvedor e clique em Carregar sem compactação. Selecione esta pasta.\n\nFixe a extensão e clique no ícone em um site. Alt+Shift+Y também ativa a barra.\n\nPara voz, entre em https://novah.auis.design no mesmo perfil do Chrome. A chave OpenAI fica no servidor.\n\nOs comentários ficam neste perfil: exporte um pacote completo antes de desinstalar ou mudar de computador.\n")
for (const [name, script] of [["library", "library"], ["export", "export"]]) {
  await fs.writeFile(path.join(dist, name + ".html"), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AuisRewiew</title></head><body><div id="root"></div><script src="${script}.js"></script></body></html>`)
}
async function files(dir, prefix = "") {
  const result = {}
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    if (item.name.endsWith(".zip")) continue
    const key = prefix + item.name
    if (item.isDirectory()) Object.assign(result, await files(path.join(dir, item.name), key + "/"))
    else result[key] = new Uint8Array(await fs.readFile(path.join(dir, item.name)))
  }
  return result
}
await fs.writeFile(path.join(dist, "AuisRewiew.zip"), zipSync(await files(dist), { level: 6 }))
console.log(`Extensão pronta: ${dist}`)
