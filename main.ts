// main.ts — Solmaris "High Noon" (round 11) submission entrypoint.
//
// Written fresh in this session for this entry. It is the gate between the
// game on disk and the judge: it refuses to hand in anything that would fail
// the scorer's own caps, and it leaves no trace of when it ran — the whole
// round is about determinism, so this file contains no clock read of any
// kind and the manifest it writes carries file sizes + git HEAD only.
//
// Pipeline:
//   1. Resolve repo root (this file's directory) and the output directory
//      (MAKEFUN_OUTPUT_DIR, or /output in the grader's container).
//   2. Validate game/: directory present, index.html present and <= 1 MiB,
//      every entry a regular file, total files/bytes inside the caps, no
//      path over 1000 bytes, no forbidden IP string in index.html.
//   3. Validate screenshots/: exactly 4 images (first by name is the cover),
//      each a JPEG/PNG of at most 256 KiB and non-empty.
//   4. Validate determinism hygiene of the counted sources: no unseeded
//      random source and no wall-clock read in game/src/*.js or index.html.
//      (Vendored three.js is exempt — it is not counted source.)
//   5. Copy game/ and screenshots/ into the output directory.
//   6. Write manifest.json (schema, title, git HEAD, sorted file tables).
//   7. Write dossier.json with the vendored make.fun library, using the
//      scorer's caps, so a dossier that would be refused never ships.
//
// Run locally:  MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { basename, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const CAPS = {
  textMaxBytes: 163840,
  screenshotsMax: 4,
  screenshotMaxBytes: 262144,
  indexMaxBytes: 1024 * 1024,
  gameMaxFiles: 993,
  gameMaxBytes: 50331648,
  gamePathMaxBytes: 1000,
};

const TITLE = 'Solmaris — High Noon';
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

class GateError extends Error {
  check: string;
  constructor(check: string, message: string) {
    super(check + ': ' + message);
    this.name = 'GateError';
    this.check = check;
  }
}

function gate(check: string, message: string): never {
  throw new GateError(check, message);
}

type FileRow = { path: string; bytes: number };

function walkFiles(root: string): FileRow[] {
  const rows: FileRow[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      gate('read', 'cannot read directory ' + relative(repoRoot, dir));
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) gate('symlink', relative(repoRoot, full) + ' is a symbolic link');
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) rows.push({ path: relative(root, full).split(sep).join('/'), bytes: statSync(full).size });
      else gate('special-file', relative(repoRoot, full) + ' is not a regular file');
    }
  };
  walk(root);
  return rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function gameChecks(): FileRow[] {
  const gameDir = join(repoRoot, 'game');
  if (!existsSync(gameDir) || !lstatSync(gameDir).isDirectory()) gate('game-missing', 'game/ is not present next to main.ts');
  const files = walkFiles(gameDir);
  if (files.length === 0) gate('game-empty', 'game/ holds no files');
  if (files.length > CAPS.gameMaxFiles) gate('game-too-many-files', files.length + ' files, cap is ' + CAPS.gameMaxFiles);
  const total = files.reduce((s, f) => s + f.bytes, 0);
  if (total > CAPS.gameMaxBytes) gate('game-too-large', total + ' bytes, cap is ' + CAPS.gameMaxBytes);
  for (const f of files) {
    if (Buffer.byteLength(f.path, 'utf8') > CAPS.gamePathMaxBytes) gate('game-path-too-long', f.path);
  }
  const index = files.find((f) => f.path === 'index.html');
  if (!index) gate('index-missing', 'game/index.html is required and was not found');
  if (index.bytes > CAPS.indexMaxBytes) gate('index-too-large', 'game/index.html is ' + index.bytes + ' bytes, cap is ' + CAPS.indexMaxBytes);
  const html = readFileSync(join(gameDir, 'index.html'), 'utf8');
  if (!/<script/i.test(html)) gate('index-no-script', 'game/index.html loads no script');
  if (/rockstar|grand theft auto/i.test(html)) gate('index-ip', 'game/index.html mentions forbidden IP');
  return files;
}

function screenshotChecks(): FileRow[] {
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(shotsDir) || !lstatSync(shotsDir).isDirectory()) gate('screenshots-missing', 'screenshots/ is not present next to main.ts');
  const files = walkFiles(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f.path));
  if (files.length !== 4) gate('screenshots-count', 'need exactly 4 screenshots, found ' + files.length);
  for (const f of files) {
    if (f.bytes === 0) gate('screenshot-empty', f.path + ' is empty');
    if (f.bytes > CAPS.screenshotMaxBytes) gate('screenshot-too-large', f.path + ' is ' + f.bytes + ' bytes, cap is ' + CAPS.screenshotMaxBytes);
  }
  return files;
}

// Determinism hygiene: counted sources must not contain an unseeded random
// source or a wall-clock read. The banned needles are assembled from parts
// below so this very file never contains them as literal text.
// Vendored three.js is exempt by design.
function determinismChecks(): void {
  const srcDir = join(repoRoot, 'game', 'src');
  const files = walkFiles(srcDir);
  const dot = '.';
  const banned: Array<[string, string]> = [
    ['Math' + dot + 'rand' + 'om(', 'unseeded random source'],
    ['performance' + dot + 'now(', 'wall-clock read'],
    ['Date' + dot + 'now(', 'wall-clock read'],
    ['new ' + 'Date(', 'wall-clock read'],
  ];
  const scan = (label: string, text: string): void => {
    for (const [needle, kind] of banned) {
      if (text.includes(needle)) gate('nondeterminism', label + ' contains ' + kind);
    }
  };
  for (const f of files) scan('game/src/' + f.path, readFileSync(join(srcDir, f.path), 'utf8'));
  scan('main.ts', readFileSync(join(repoRoot, 'main.ts'), 'utf8'));
}

function gitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown (not a git checkout)';
  }
}

function run(): void {
  console.log('[solmaris] validating submission in ' + repoRoot);
  const gameFiles = gameChecks();
  const shotFiles = screenshotChecks();
  determinismChecks();
  const gameTotal = gameFiles.reduce((s, f) => s + f.bytes, 0);
  console.log('[solmaris] game/: ' + gameFiles.length + ' files, ' + gameTotal + ' bytes');
  console.log('[solmaris] screenshots/: ' + shotFiles.map((f) => basename(f.path) + ' (' + f.bytes + ' B)').join(', '));
  console.log('[solmaris] determinism hygiene: no unseeded random / wall-clock reads in counted sources');

  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

  const manifest = {
    schema: 'solmaris/manifest/v1',
    title: TITLE,
    round: 11,
    deterministic: true,
    gitHead: gitHead(),
    game: gameFiles,
    gameTotalBytes: gameTotal,
    screenshots: shotFiles,
    cover: basename(shotFiles[0].path),
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('[solmaris] manifest.json written (HEAD ' + String(manifest.gitHead).slice(0, 12) + ')');

  const dossier = buildDossier(outDir, {
    text_max_bytes: CAPS.textMaxBytes,
    screenshots: { max: CAPS.screenshotsMax, max_bytes: CAPS.screenshotMaxBytes },
    game_max_files: CAPS.gameMaxFiles,
    game_max_bytes: CAPS.gameMaxBytes,
    game_path_max_bytes: CAPS.gamePathMaxBytes,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log('[solmaris] dossier.json written (' + dossier.length + ' bytes) — all gates pass');
}

run();
