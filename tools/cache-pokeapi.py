"""Refresh the local PokéAPI catalogue and official HD artwork."""
import concurrent.futures,json
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
IDS=[1,2,3,4,5,6,7,8,9,10,12,16,19,23,25,27,37,39,41,43,50,52,54,58,63,66,74,81,92,95,104,111,123,129,130,131,133,143,147,149,150,152,26,134,135,136,153,154]
MOVE_IDS=[33,52,55,22,84,98,40,16,450,88,189,93,122,67,225,181,232,44,188,58,53,75,246]
def get(url):
 r=requests.get(url,timeout=30);r.raise_for_status();return r

def pokemon(i):
 d=get(f'https://pokeapi.co/api/v2/pokemon/{i}').json();image=d['sprites']['other']['official-artwork']['front_default']
 out=ROOT/'assets'/'artwork'/f'{i}.png'
 if not out.exists():out.write_bytes(get(image).content)
 return str(i),{'id':i,'name':d['name'].capitalize(),'types':[x['type']['name'] for x in d['types']],'stats':{x['stat']['name']:x['base_stat'] for x in d['stats']},'learnset':[int(x['move']['url'].rstrip('/').split('/')[-1]) for x in d['moves'] if int(x['move']['url'].rstrip('/').split('/')[-1]) in MOVE_IDS],'artwork':f'assets/artwork/{i}.png','source':f'https://pokeapi.co/api/v2/pokemon/{i}'}
def move(i):
 d=get(f'https://pokeapi.co/api/v2/move/{i}').json()
 return str(i),{'id':i,'name':d['name'].replace('-',' ').title(),'power':d['power'] or 40,'type':d['type']['name'],'damageClass':d['damage_class']['name'],'pp':d['pp'],'source':f'https://pokeapi.co/api/v2/move/{i}'}
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
  mons=dict(pool.map(pokemon,IDS));moves=dict(pool.map(move,MOVE_IDS))
 for name,data in [('pokemon',mons),('moves',moves)]:
  (ROOT/'data'/f'{name}.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
 print(f'Cached {len(mons)} species, HD illustrations and {len(moves)} attacks.')
