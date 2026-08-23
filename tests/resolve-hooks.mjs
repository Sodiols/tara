import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Module resolution shim for `node --test`.
 *
 * The application is written for a bundler, so it uses two specifier styles
 * Node's ESM resolver does not understand on its own:
 *
 *   import { x } from "./phone"        // no file extension
 *   import { y } from "@/lib/format"   // tsconfig path alias
 *
 * Rewriting every import purely to make tests run would be the tail wagging the
 * dog. This hook teaches the test process the same two rules the bundler
 * already applies, and is used nowhere else — production code is resolved by
 * Next.js, not by this file.
 */

const projectRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];

function firstExisting(basePath) {
  if (existsSync(basePath) && path.extname(basePath)) return basePath;
  for (const extension of EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const extension of EXTENSIONS) {
    const candidate = path.join(basePath, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // tsconfig "paths": { "@/*": ["./*"] }
    if (specifier.startsWith("@/")) {
      const resolved = firstExisting(path.join(projectRoot, specifier.slice(2)));
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }

    // Extensionless relative imports.
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : projectRoot;
      const resolved = firstExisting(path.resolve(path.dirname(parentPath), specifier));
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
