import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

// Each data/gallery manifest must list every photo in its folder exactly once, with
// dimensions matching the file (run scripts/gallery-metadata.mjs after changing photos).
function jpegSize(path) {
  const b = readFileSync(path);
  for (let i = 2; i < b.length;) {
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`${path}: no JPEG frame header`);
}

const tournaments = readFileSync('lib/tournaments.ts', 'utf8');
const manifests = readdirSync('data/gallery').filter(f => f.endsWith('.json'));
assert.ok(manifests.length, 'no gallery manifests');
let total = 0;
for (const name of manifests) {
  const m = JSON.parse(readFileSync(`data/gallery/${name}`, 'utf8'));
  assert.equal(name, `${m.tournamentId}.json`, `${name} must be named after its tournamentId`);
  const [series, edition] = m.directory.split('/');
  assert.ok(tournaments.includes(`tournamentId("${series}", "${edition}")`), `${m.tournamentId} is not in lib/tournaments.ts`);
  assert.ok(readFileSync('lib/gallery.ts', 'utf8').includes(`@/data/gallery/${name}`), `lib/gallery.ts does not load ${name}`);
  assert.ok(existsSync(`app/${m.directory}/gallery/page.tsx`), `app/${m.directory}/gallery/page.tsx missing`);
  const files = m.chapters.flatMap(c => c.photos.map(p => p.file));
  assert.equal(new Set(files).size, files.length, `${name}: a photo is listed twice`);
  assert.equal(new Set(m.chapters.map(c => c.id)).size, m.chapters.length, `${name}: duplicate chapter id`);
  assert.ok(files.includes(m.cover), `${name}: cover ${m.cover} is not in any chapter`);
  const onDisk = readdirSync(`public/${m.directory}`).filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f));
  for (const f of onDisk) assert.ok(files.includes(f), `public/${m.directory}/${f} is not in ${name}`);
  for (const c of m.chapters) {
    assert.ok(c.photos.length, `${name}: chapter ${c.id} is empty`);
    for (const p of c.photos) {
      const path = `public/${m.directory}/${p.file}`;
      assert.ok(onDisk.includes(p.file), `${name}: missing photo ${path}`);
      assert.ok(p.alt?.trim(), `${name}: ${p.file} needs alt text`);
      assert.match(p.blurDataURL ?? '', /^data:image\/\w+;base64,/, `${name}: ${p.file} lacks a blur placeholder`);
      if (/\.jpe?g$/i.test(p.file)) {
        // EXIF-rotated photos store their displayed (swapped) size.
        const { width, height } = jpegSize(path);
        assert.ok([`${width}x${height}`, `${height}x${width}`].includes(`${p.width}x${p.height}`), `${name}: ${p.file} size is stale`);
      }
    }
  }
  total += files.length;
}
console.log(`PASS ${manifests.length} gallery manifest(s) list all ${total} photos with current sizes.`);
