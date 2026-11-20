// Neon Coast Cover Studio: entrypoint.
// Copies app/ and screenshots/ into the output directory and writes the
// dossier the gate checks, using the kit's buildDossier library.
// Node 22 standard library only; no install, no network, no build step.
// Run: MAKEFUN_OUTPUT_DIR=out node main.ts
// (In the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used.)
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repo dir is where this file lives, not the working directory: the
// grader runs `node /bot/main.ts` from its own cwd, so process.cwd() is
// not the repo and the copy below would fail with ENOENT (exit 1).
const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
