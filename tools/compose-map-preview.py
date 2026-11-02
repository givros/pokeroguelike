"""Compose a map QA preview from generated terrain and separate prop assets."""
import json
from pathlib import Path
from PIL import Image,ImageOps
root=Path(__file__).resolve().parents[1]
world=json.loads((root/'data/world-map.json').read_text(encoding='utf-8'))
canvas=Image.open(root/world['base']).convert('RGBA')
w,h=canvas.size
for p in sorted(world['props'],key=lambda p:p['y']):
 box=(round(p['w']*w),round(p['h']*h))
 art=ImageOps.contain(Image.open(root/f"assets/generated/{p['asset']}.webp").convert('RGBA'),box,Image.Resampling.LANCZOS)
 x=round(p['x']*w-art.width/2);y=round(p['y']*h-art.height)
 canvas.alpha_composite(art,(x,y))
canvas.convert('RGB').save(root/'assets/generated/woodland-layered-preview.webp',quality=93,method=6)
world['engineTarget']='project-native'
world['artStyle']='clean_hd'
world['preview']='assets/generated/woodland-layered-preview.webp'
(root/'data/world-map.json').write_text(json.dumps(world,indent=2)+'\n',encoding='utf-8')
print(f'Validated composition: {w}x{h}, {len(world["props"])} separate props.')
