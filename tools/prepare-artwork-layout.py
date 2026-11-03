"""Measure existing official artwork without modifying its pixels."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
catalogue = json.loads((ROOT / 'data/pokemon.json').read_text(encoding='utf-8'))
layout = {}
for key, species in catalogue.items():
    source = ROOT / species['artwork']
    image = Image.open(source).convert('RGBA')
    bounds = image.getchannel('A').point(lambda value: 255 if value > 32 else 0).getbbox()
    if not bounds:
        raise ValueError(f'Artwork has no visible pixels: {source}')
    layout[key] = {'size': list(image.size), 'bounds': list(bounds),
                   'sha256': hashlib.sha256(source.read_bytes()).hexdigest()}
(ROOT / 'data/artwork-layout.json').write_text(json.dumps(layout, indent=2) + '\n', encoding='utf-8')
print(f'Measured {len(layout)} original HD images; source artwork unchanged.')
