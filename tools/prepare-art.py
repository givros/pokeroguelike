from pathlib import Path
from PIL import Image
import json
root=Path('assets/generated'); manifest=[]
for p in root.glob('*.png'):
 if p.stem.endswith('-raw'):
  continue
 im=Image.open(p).convert('RGBA');alpha=im.getchannel('A');transparent=alpha.getextrema()[0]<255
 if transparent:
  bounds=alpha.getbbox();im=im.crop(bounds)
  cap=768 if p.stem in ['woodland-tree','silver-willow','mossy-rocks','trail-sign','parchment-panel'] else 512
  im.thumbnail((cap,cap),Image.Resampling.LANCZOS)
 target=p.with_suffix('.webp')
 if not target.exists() or target.stat().st_mtime < p.stat().st_mtime:
  prepared=im if transparent else im.convert('RGB')
  temporary=target.with_suffix('.webp.tmp')
  prepared.save(temporary,format='WEBP',quality=94 if transparent else 92,method=6)
  temporary.replace(target)
 manifest.append({'id':p.stem,'image':p.with_suffix('.webp').as_posix(),'source':p.as_posix(),'prompt':p.with_suffix('.prompt.txt').as_posix(),'generator':'built-in imagegen','size':im.size,'transparent':transparent})
for p in Path('assets/effects').glob('*-sheet.png'):
 im=Image.open(p).convert('RGBA')
 target=p.with_suffix('.webp')
 if not target.exists() or target.stat().st_mtime < p.stat().st_mtime:
  temporary=target.with_suffix('.webp.tmp')
  im.save(temporary,format='WEBP',quality=96,method=6)
  temporary.replace(target)
 name=p.stem.removesuffix('-sheet')
 manifest.append({'id':name,'image':target.as_posix(),'source':p.as_posix(),'rawSource':p.with_name(name+'-raw.png').as_posix(),'prompt':p.with_name(name+'.prompt.txt').as_posix(),'generator':'built-in imagegen','size':im.size,'transparent':True,'rows':2,'columns':2,'frames':4})
for item in manifest:
 raw=Path(item['source']).with_name(item['id']+'-raw.png')
 if raw.exists() and 'rawSource' not in item: item['rawSource']=raw.as_posix()
Path('data/asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'assets':len(manifest),'transparent':sum(a['transparent'] for a in manifest),'webpBytes':sum(p.stat().st_size for p in Path('assets').rglob('*.webp'))}))
