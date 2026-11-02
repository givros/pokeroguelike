"""Compose a map QA preview from generated terrain and separate prop assets."""
import json
import sys
from pathlib import Path
from PIL import Image,ImageOps
root=Path(__file__).resolve().parents[1]
world=json.loads((root/'data/world-map.json').read_text(encoding='utf-8'))
region=sys.argv[1] if len(sys.argv)>1 else 'woodland'
biome=world.get('regions',{}).get(region,world)
canvas=Image.open(root/biome['base']).convert('RGBA')
w,h=canvas.size
for p in sorted(biome['props'],key=lambda p:p['y']):
 box=(round(p['w']*w),round(p['h']*h))
 art=ImageOps.contain(Image.open(root/f"assets/generated/{p['asset']}.webp").convert('RGBA'),box,Image.Resampling.LANCZOS)
 x=round(p['x']*w-art.width/2);y=round(p['y']*h-art.height)
 canvas.alpha_composite(art,(x,y))
preview=f'assets/generated/{region}-layered-preview.webp'
canvas.convert('RGB').save(root/preview,quality=93,method=6)
world['engineTarget']='project-native'
world['artStyle']='clean_hd'
if region=='woodland': world['preview']=preview
if region in world.get('regions',{}): world['regions'][region]['preview']=preview
(root/'data/world-map.json').write_text(json.dumps(world,indent=2)+'\n',encoding='utf-8')
print(f'Composed {region}: {w}x{h}, {len(biome["props"])} separate props. Visual inspection required.')
