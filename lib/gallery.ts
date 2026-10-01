import type { StaticImageData } from "next/image";
import { tournaments } from "@/lib/tournaments";
// One manifest per tournament: photos live in public/<directory>/, descriptions
// and chapters in data/gallery/<tournament-id>.json. Width, height and blur
// placeholders come from scripts/gallery-metadata.mjs; tests/gallery.test.mjs
// keeps each manifest in sync with its photo folder.
import hachicats20260927 from "@/data/gallery/hachicats-20260927.json";

type ManifestPhoto = { file: string; alt: string; caption?: string; width: number; height: number; blurDataURL: string };
type Manifest = {
  tournamentId: string;
  directory: string;
  location: string;
  summary: string;
  cover: string;
  chapters: { id: string; title: string; en: string; description: string; photos: ManifestPhoto[] }[];
};

export type GalleryPhoto = { id: string; image: StaticImageData; alt: string; caption?: string };
export type GalleryChapter = { id: string; title: string; en: string; description: string; photos: GalleryPhoto[] };
export type TournamentGallery = {
  tournamentId: string;
  href: string;
  tournamentHref: string;
  name: string;
  series: string;
  date: string;
  displayDate: string;
  location: string;
  summary: string;
  cover: GalleryPhoto;
  chapters: GalleryChapter[];
};

const manifests: Manifest[] = [hachicats20260927];

function loadGallery(manifest: Manifest): TournamentGallery {
  const tournament = tournaments.find(event => event.id === manifest.tournamentId);
  if (!tournament) throw new Error(`Gallery for unknown tournament ${manifest.tournamentId}`);
  const chapters = manifest.chapters.map(({ photos, ...chapter }) => ({
    ...chapter,
    photos: photos.map(({ file, alt, caption, width, height, blurDataURL }) => ({
      id: file,
      image: { src: `/${manifest.directory}/${file}`, width, height, blurDataURL },
      alt,
      caption,
    })),
  }));
  const cover = chapters.flatMap(chapter => chapter.photos).find(photo => photo.id === manifest.cover);
  if (!cover) throw new Error(`Gallery cover ${manifest.cover} is not in any chapter`);
  return {
    tournamentId: tournament.id,
    href: `${tournament.href}/gallery`,
    tournamentHref: tournament.href,
    name: tournament.name,
    series: tournament.series,
    date: tournament.date,
    displayDate: tournament.displayDate,
    location: manifest.location,
    summary: manifest.summary,
    cover,
    chapters,
  };
}

export const galleries: TournamentGallery[] = manifests.map(loadGallery);

export function galleryPhotos(gallery: TournamentGallery) {
  return gallery.chapters.flatMap(chapter => chapter.photos);
}

export function findGallery(tournamentId: string) {
  const gallery = galleries.find(g => g.tournamentId === tournamentId);
  if (!gallery) throw new Error("Unknown gallery");
  return gallery;
}
