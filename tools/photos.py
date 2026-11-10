#!/usr/bin/env python3
"""Make the USA theme's two photographs from their originals. Never shipped (tools/ is export-ignore).

    python3 tools/photos.py [folder of originals]     needs Pillow, numpy and cwebp

Expected behaviour:
  - Reads each photograph named in content/record.json (theme.photos): its file on Wikimedia Commons, the part of
    the frame to keep, and the filter. An original already in the folder (as <id>.jpg) is used; otherwise it is
    fetched from Commons by its exact title, and from nowhere else.
  - Writes v4/usa/<id>.webp (1600 wide) and v4/usa/<id>-800.webp. The treatment is the same on every run: a
    black-and-white conversion through a red filter (which turns a blue sky black), a tone curve, and a fixed grain.
  - Nothing is drawn on a photograph and nothing is taken out of one: it is cropped and set in black and white,
    and the page says so beside the photographer's name.
"""
import json
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
AGENT = {'User-Agent': 'seansooch.dev theme build'}
SIZES = ((1600, ''), (800, '-800'))


def original(photo, folder):
    """The photograph as Commons holds it, at the largest size it serves up to 3840 wide."""
    kept = folder / f"{photo['id']}.jpg"
    if kept.is_file():
        return Image.open(kept)
    ask = {'action': 'query', 'titles': photo['file'], 'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': '3840', 'format': 'json'}
    with urllib.request.urlopen(urllib.request.Request('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(ask), headers=AGENT), timeout=60) as r:
        info = next(iter(json.load(r)['query']['pages'].values()))['imageinfo'][0]
    with urllib.request.urlopen(urllib.request.Request(info['thumburl'], headers=AGENT), timeout=120) as r:
        kept.write_bytes(r.read())
    return Image.open(kept)


def filtered(im, mix, black, contrast, grain=0.03, seed=7):
    """Black and white through a colour filter. The mix acts on light, not on encoded values."""
    a = np.asarray(im.convert('RGB'), dtype=np.float32) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    y = np.clip(lin[..., 0] * mix[0] + lin[..., 1] * mix[1] + lin[..., 2] * mix[2], 0, 1)
    y = np.where(y <= 0.0031308, y * 12.92, 1.055 * np.power(y, 1 / 2.4) - 0.055)
    y = np.clip((y - black) / (0.96 - black), 0, 1)
    y = np.clip(y + contrast * 0.25 * np.sin((y - 0.5) * np.pi) + contrast * (y - 0.5) * (1 - np.abs(2 * y - 1)) * 0.5, 0, 1)
    y = y + np.random.default_rng(seed).normal(0, grain, y.shape).astype(np.float32) * (0.35 + 0.65 * (1 - np.abs(2 * y - 1)))
    return Image.fromarray((np.clip(y, 0, 1) * 255 + 0.5).astype(np.uint8), 'L')


def main(argv):
    folder = Path(argv[0]) if argv else Path(tempfile.gettempdir()) / 'seansooch-theme-originals'
    folder.mkdir(parents=True, exist_ok=True)
    out = ROOT / 'v4' / 'usa'
    out.mkdir(exist_ok=True)
    for photo in json.loads((ROOT / 'content' / 'record.json').read_text(encoding='utf-8'))['theme']['photos']:
        im = original(photo, folder)
        x0, y0, x1, y1 = (round(f * side) for f, side in zip(photo['keep'], (im.width, im.height, im.width, im.height)))
        im = im.crop((x0, y0, x1, y1))
        for width, tail in SIZES:
            small = im.resize((width, round(width * im.height / im.width)), Image.LANCZOS)
            with tempfile.NamedTemporaryFile(suffix='.png') as png:
                filtered(small, photo['mix'], photo['black'], photo['contrast']).save(png.name)
                subprocess.run(['cwebp', '-quiet', '-q', '74', '-m', '6', png.name, '-o', str(out / f"{photo['id']}{tail}.webp")], check=True)
            print(f"{photo['id']}{tail}.webp  {(out / (photo['id'] + tail + '.webp')).stat().st_size // 1024} KB")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
