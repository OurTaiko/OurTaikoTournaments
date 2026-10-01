import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

// Every photo dropped into a tournament folder must be listed in lib/gallery.ts exactly once.
const source = readFileSync('lib/gallery.ts', 'utf8');
const imported = [...source.matchAll(/from "@\/public\/([^"]+)"/g)].map(m => m[1]);
assert.ok(imported.length, 'gallery imports no photos');
assert.equal(new Set(imported).size, imported.length, 'a photo is imported twice');
for (const path of imported) assert.ok(existsSync(`public/${path}`), `missing photo public/${path}`);
for (const folder of ['hachicats/20260927']) {
  for (const file of readdirSync(`public/${folder}`).filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f)))
    assert.ok(imported.includes(`${folder}/${file}`), `public/${folder}/${file} is not in lib/gallery.ts`);
}
for (const page of ['app/gallery/page.tsx', 'app/hachicats/20260927/gallery/page.tsx']) assert.ok(existsSync(page), `${page} missing`);
console.log(`PASS gallery lists all ${imported.length} photos.`);
