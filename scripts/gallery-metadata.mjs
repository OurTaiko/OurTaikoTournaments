// Fill width, height and blur placeholder for every photo in a gallery manifest.
// Edit file / alt / caption / chapters by hand, then rerun this after adding or replacing photos.
// Usage: node scripts/gallery-metadata.mjs data/gallery/<tournament-id>.json
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const [path] = process.argv.slice(2);
if (!path) throw new Error('Usage: node scripts/gallery-metadata.mjs data/gallery/<tournament-id>.json');
const manifest = JSON.parse(readFileSync(path, 'utf8'));
for (const chapter of manifest.chapters) {
  chapter.photos = await Promise.all(chapter.photos.map(async ({ file, alt, caption }) => {
    const image = sharp(`public/${manifest.directory}/${file}`).rotate();
    const { width, height } = await image.clone().metadata().then(m => (m.orientation ?? 1) >= 5 ? { width: m.height, height: m.width } : m);
    // Same shape Next.js uses for static imports: an 8px-wide WebP, blurred by next/image.
    const blur = await image.resize(8).webp({ quality: 70 }).toBuffer();
    return { file, alt, caption, width, height, blurDataURL: `data:image/webp;base64,${blur.toString('base64')}` };
  }));
}
writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Updated ${manifest.chapters.reduce((n, c) => n + c.photos.length, 0)} photos in ${path}`);
