// Builds contact sheets (one row per trail, up to 6 candidates) for manual
// review of scripts/photos/candidates.json. Requires Python + Pillow locally.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'scripts', 'photos');
const thumbs = path.join(dir, 'thumbs');
fs.mkdirSync(thumbs, { recursive: true });
const UA = 'TrailingApp/1.0 (https://trailing.pages.dev; trail cover photos)';
const UTAH = /utah|\bslc\b|zion|bryce|arches|canyonlands|capitol reef|wasatch|uinta|moab|provo|ogden|logan|salt lake|escalante|kanab|timpanogos|cottonwood|alta|brighton|park city|heber|st\.? george|cedar city|vernal|dinosaur national|goblin valley|san rafael|antelope island|bears ears|natural bridges|grand staircase/i;

const cands = JSON.parse(fs.readFileSync(path.join(dir, 'candidates.json'), 'utf8'));
const rows = [];
for (const [slug, c] of Object.entries(cands)) {
  const picks = c.picks.filter((p) => p.sources.includes('override') || (p.distance_km != null && p.distance_km <= 30)
    || UTAH.test(`${p.title} ${p.description} ${p.categories}`)).slice(0, 6);
  c.reviewable = picks;
  const files = [];
  for (const [i, p] of picks.entries()) {
    const f = path.join(thumbs, `${slug}-${i}.jpg`);
    if (!fs.existsSync(f)) {
      // Wikimedia only serves standard thumbnail widths (e.g. 330, 500, 960, 1280, 1920).
      const url = p.thumb.replace(/\/\d+px-/, '/330px-');
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (res.ok) { fs.writeFileSync(f, Buffer.from(await res.arrayBuffer())); break; }
        if (res.status !== 429 && res.status < 500) { console.log('skip', res.status, url); break; }
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    if (fs.existsSync(f)) files.push(f);
  }
  rows.push({ slug, files });
}
fs.writeFileSync(path.join(dir, 'candidates.json'), JSON.stringify(cands, null, 2));
fs.writeFileSync(path.join(dir, 'rows.json'), JSON.stringify(rows));
execFileSync('python3', ['-c', `
import json, os
from PIL import Image, ImageDraw, ImageFont
rows = json.load(open(${JSON.stringify(path.join(dir, 'rows.json'))}))
out = ${JSON.stringify(path.join(dir, 'sheets'))}
os.makedirs(out, exist_ok=True)
W, H, L = 240, 150, 230
try: font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 15)
except Exception: font = ImageFont.load_default()
per = 7
for s in range(0, len(rows), per):
    chunk = rows[s:s+per]
    sheet = Image.new('RGB', (L + 6 * (W + 6), len(chunk) * (H + 8)), (250, 248, 240))
    d = ImageDraw.Draw(sheet)
    for r, row in enumerate(chunk):
        y = r * (H + 8)
        d.text((6, y + 6), row['slug'], fill=(20, 20, 20), font=font)
        for i, f in enumerate(row['files']):
            im = Image.open(f).convert('RGB'); im.thumbnail((W, H))
            x = L + i * (W + 6)
            sheet.paste(im, (x, y))
            d.rectangle([x, y, x + 22, y + 20], fill=(0, 0, 0)); d.text((x + 6, y + 2), str(i), fill=(255, 255, 255), font=font)
    sheet.save(os.path.join(out, 'sheet-%02d.jpg' % (s // per)), quality=80)
print('sheets:', (len(rows) + per - 1) // per)
`], { stdio: 'inherit' });
