"""Import default National Pokédex species and their original official artwork."""

import csv
import io
import json
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from time import sleep
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
CSV_BASE = 'https://cdn.jsdelivr.net/gh/PokeAPI/pokeapi@master/data/v2/csv/'
ART_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/'


def download(url):
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'PokeRogue catalogue importer'}), timeout=30) as response:
                return response.read()
        except OSError:
            if attempt == 3:
                raise
            sleep(2 ** attempt)


def table(name):
    return list(csv.DictReader(io.StringIO(download(CSV_BASE + name + '.csv').decode('utf-8-sig'))))


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def save(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def artwork(species):
    path = ROOT / species['artwork']
    if path.exists():
        return
    original = download(f"{ART_BASE}{species['id']}.png")
    with Image.open(io.BytesIO(original)) as image:
        image.verify()
    path.write_bytes(original)


def main():
    names = ('pokemon', 'pokemon_species', 'pokemon_species_names', 'pokemon_stats',
             'pokemon_types', 'pokemon_moves', 'moves', 'move_names', 'types', 'stats')
    with ThreadPoolExecutor(max_workers=8) as workers:
        rows = dict(zip(names, workers.map(table, names)))

    defaults = {row['id']: row['species_id'] for row in rows['pokemon'] if row['is_default'] == '1'}
    species_metadata = {row['id']: row for row in rows['pokemon_species']}
    if set(defaults.values()) != set(species_metadata):
        raise ValueError('Default Pokémon do not cover every National Pokédex species')

    pokemon = load(DATA / 'pokemon.json')
    moves = load(DATA / 'moves.json')
    locale = load(DATA / 'locales/fr.json')
    type_ids = {row['id']: row['identifier'] for row in rows['types']}
    stat_ids = {row['id']: row['identifier'] for row in rows['stats']}
    species_names = {(row['pokemon_species_id'], row['local_language_id']): row['name']
                     for row in rows['pokemon_species_names']}
    move_names = {(row['move_id'], row['local_language_id']): row['name'] for row in rows['move_names']}
    damaging_moves = {row['id']: row for row in rows['moves']
                      if row['power'] and int(row['power']) > 0 and row['pp']
                      and int(row['pp']) > 0 and row['damage_class_id'] in ('2', '3')
                      and row['id'] != '225'}  # Dragon Breath requires a manually aligned effect origin.

    stats = defaultdict(dict)
    types = defaultdict(dict)
    attacks = defaultdict(set)
    for row in rows['pokemon_stats']:
        stats[row['pokemon_id']][stat_ids[row['stat_id']]] = int(row['base_stat'])
    for row in rows['pokemon_types']:
        types[row['pokemon_id']][int(row['slot'])] = type_ids[row['type_id']]
    for row in rows['pokemon_moves']:
        if row['pokemon_id'] in defaults and row['pokemon_move_method_id'] == '1' and row['move_id'] in damaging_moves:
            attacks[row['pokemon_id']].add(row['move_id'])

    for pokemon_id, species_id in defaults.items():
        species = species_metadata[species_id]
        if species['is_legendary'] == '1' or species['is_mythical'] == '1':
            rarity = 'legendary'
        else:
            rarity = 'rare' if int(species['capture_rate']) <= 60 else 'common'
        if species_id in pokemon:
            pokemon[species_id]['rarity'] = rarity
            if species['is_mythical'] == '1':
                pokemon[species_id]['mythical'] = True
            continue
        name = species_names[species_id, '9']
        locale['translations'][name] = species_names[species_id, '5']
        learnset = sorted(attacks[pokemon_id], key=int)
        pokemon[species_id] = {
            'id': int(species_id), 'name': name, 'types': [v for _, v in sorted(types[pokemon_id].items())],
            'stats': stats[pokemon_id], 'learnset': list(map(int, learnset)),
            'artwork': f'assets/artwork/{species_id}.png', 'source': f'https://pokeapi.co/api/v2/pokemon/{pokemon_id}',
            'rarity': rarity,
        }
        if species['is_mythical'] == '1':
            pokemon[species_id]['mythical'] = True
        for move_id in learnset:
            if move_id in moves:
                continue
            row = damaging_moves[move_id]
            move = move_names[move_id, '9']
            locale['translations'][move] = move_names[move_id, '5']
            moves[move_id] = {
                'id': int(move_id), 'name': move, 'power': int(row['power']), 'type': type_ids[row['type_id']],
                'damageClass': {'2': 'physical', '3': 'special'}[row['damage_class_id']], 'pp': int(row['pp']),
                'source': f'https://pokeapi.co/api/v2/move/{move_id}',
            }

    with ThreadPoolExecutor(max_workers=12) as workers:
        for index, _ in enumerate(workers.map(artwork, pokemon.values()), 1):
            if index % 100 == 0:
                print(f'{index}/{len(pokemon)} artworks ready', flush=True)

    save(DATA / 'pokemon.json', dict(sorted(pokemon.items(), key=lambda pair: int(pair[0]))))
    save(DATA / 'moves.json', dict(sorted(moves.items(), key=lambda pair: int(pair[0]))))
    save(DATA / 'locales/fr.json', locale)
    print(f'Imported {len(pokemon)} species and {len(moves)} attacks.', flush=True)


if __name__ == '__main__':
    main()
