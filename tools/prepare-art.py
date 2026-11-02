from pathlib import Path
from PIL import Image
import json
root=Path('assets/generated'); manifest=[]
for p in root.glob('*.png'):
 im=Image.open(p).convert('RGBA');alpha=im.getchannel('A');transparent=alpha.getextrema()[0]<255
 if transparent:
  bounds=alpha.getbbox();im=im.crop(bounds)
  cap=768 if p.stem in ['woodland-tree','mossy-rocks','trail-sign','parchment-panel'] else 512
  im.thumbnail((cap,cap),Image.Resampling.LANCZOS)
  im.save(p.with_suffix('.webp'),quality=94,method=6)
 else:
  im.convert('RGB').save(p.with_suffix('.webp'),quality=92,method=6)
 manifest.append({'id':p.stem,'image':p.with_suffix('.webp').as_posix(),'source':p.as_posix(),'prompt':p.with_suffix('.prompt.txt').as_posix(),'generator':'built-in imagegen','size':im.size,'transparent':transparent})
Path('data/asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'assets':len(manifest),'transparent':sum(a['transparent'] for a in manifest),'runtimeBytes':sum(p.stat().st_size for p in root.glob('*.webp'))}))
