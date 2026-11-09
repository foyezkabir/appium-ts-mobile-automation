import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomBytes } from 'crypto';
import * as jpeg from 'jpeg-js';

// Real photos, one per format, each exactly 512×512 px — the largest the app accepts.
let dir = path.resolve(__dirname, 'photos');
export const photos = {
  jpeg: path.join(dir, 'avatar.jpg'),
  png: path.join(dir, 'avatar.png'),
  webp: path.join(dir, 'avatar.webp'),
  heic: path.join(dir, 'avatar.heic'),
} as const;

// The app now refuses a photo by PIXEL size, before any upload: at most 512×512.
// A flat-colour JPEG of exactly the wanted size is enough — the app reads only
// the dimensions — and it stays a few KB, so nothing large is committed.
export const PHOTO_MAX_SIDE = 512;

export type SizedPhoto = { file: string; width: number; height: number };

function photoOfSize(width: number, height: number): SizedPhoto {
  let file = path.join(os.tmpdir(), `qa-photo-${width}x${height}.jpg`);
  if (!fs.existsSync(file)) {
    let data = Buffer.alloc(width * height * 4, 0x9a);
    fs.writeFileSync(file, jpeg.encode({ data, width, height }, 60).data);
  }
  return { file, width, height };
}

// Over the limit on both sides, and by ONE pixel on one side only.
export const oversizePhotos = {
  bothSides: photoOfSize(1024, 1024),
  oneSide: photoOfSize(PHOTO_MAX_SIDE + 1, PHOTO_MAX_SIDE),
} as const;
