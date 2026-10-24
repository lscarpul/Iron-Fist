#!/usr/bin/env python3
"""Scarica i dati geografici aperti usati da build_map.py nella cartella data/ (non versionata).

Fonti:
- Confini storici: aourednik/historical-basemaps (world_1938.geojson), licenza GPL-3.0
- Natural Earth 10m (dominio pubblico): regioni amministrative, terre, laghi, fiumi,
  ferrovie, porti, citta', mari
- Rilievo: Mapzen/AWS Terrain Tiles (terrarium, zoom 6)
- Copertura del suolo: ESA WorldCover 2021 (CC-BY 4.0), letta dalle panoramiche dei COG
"""
import os, sys, io, concurrent.futures as cf, urllib.request
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
os.makedirs(DATA, exist_ok=True)

NE = ['ne_10m_admin_1_states_provinces', 'ne_10m_populated_places_simple', 'ne_10m_railroads',
      'ne_10m_ports', 'ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe', 'ne_10m_lakes',
      'ne_10m_geography_regions_polys', 'ne_10m_geography_marine_polys', 'ne_10m_land',
      'ne_10m_minor_islands']

# area scaricata (lon/lat), un po' piu' larga dell'area di gioco
LON0, LON1, LAT0, LAT1 = -180, 180, -60, 84


def get(url, dst):
    if os.path.exists(dst):
        return
    print('scarico', url)
    with urllib.request.urlopen(url) as r, open(dst + '.tmp', 'wb') as f:
        f.write(r.read())
    os.replace(dst + '.tmp', dst)


def vector():
    get('https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/world_1938.geojson',
        os.path.join(DATA, 'world_1938.geojson'))
    for n in NE:
        get(f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/{n}.geojson',
            os.path.join(DATA, n + '.geojson'))


def elevation(z=5):
    """Mosaico di quote (metri) in proiezione web mercator, zoom z."""
    import math
    from PIL import Image
    out = os.path.join(DATA, f'elev_z{z}.npz')
    if os.path.exists(out):
        return
    n = 2 ** z
    tx = lambda lon: int((lon + 180) / 360 * n)
    ty = lambda lat: min(n - 1, int((1 - math.asinh(math.tan(math.radians(max(-85, min(85, lat))))) / math.pi) / 2 * n))
    x0, x1, y0, y1 = tx(LON0), min(n - 1, tx(LON1)), ty(LAT1), ty(LAT0)
    mos = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)

    def one(xy):
        x, y = xy
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
        with urllib.request.urlopen(url) as r:
            a = np.asarray(Image.open(io.BytesIO(r.read())).convert('RGB'), np.float32)
        return x, y, a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

    jobs = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    with cf.ThreadPoolExecutor(16) as ex:
        for x, y, a in ex.map(one, jobs):
            mos[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = a
    np.savez_compressed(out, elev=mos, z=z, x0=x0, y0=y0)
    print('quote', mos.shape)


def landcover(res=0.025):
    """Mosaico ESA WorldCover in lat/lon a 'res' gradi (classe 0 = dato mancante / mare)."""
    out = os.path.join(DATA, 'landcover_world.npz')
    if os.path.exists(out):
        return
    import rasterio
    os.environ.setdefault('GDAL_HTTP_MAX_RETRY', '4')
    os.environ['GDAL_DISABLE_READDIR_ON_OPEN'] = 'EMPTY_DIR'
    per = int(round(3 / res))
    lat_tiles = list(range(LAT0 // 3 * 3, LAT1, 3))
    lon_tiles = list(range(LON0 // 3 * 3, LON1, 3))
    H, W = len(lat_tiles) * per, len(lon_tiles) * per
    mos = np.zeros((H, W), np.uint8)
    top = lat_tiles[-1] + 3

    def name(lat, lon):
        return f"{'N' if lat >= 0 else 'S'}{abs(lat):02d}{'E' if lon >= 0 else 'W'}{abs(lon):03d}"

    def one(ll):
        lat, lon = ll
        u = ('/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/'
             f'ESA_WorldCover_10m_2021_v200_{name(lat, lon)}_Map.tif')
        try:
            with rasterio.open(u) as r:
                return lat, lon, r.read(1, out_shape=(per, per))
        except Exception:
            return lat, lon, None  # mare aperto: la piastrella non esiste

    jobs = [(la, lo) for la in lat_tiles for lo in lon_tiles]
    done = 0
    with cf.ThreadPoolExecutor(32) as ex:
        for lat, lon, a in ex.map(one, jobs):
            done += 1
            if a is None:
                continue
            r0 = (top - (lat + 3)) * per // 3
            c0 = (lon - lon_tiles[0]) * per // 3
            mos[r0:r0 + per, c0:c0 + per] = a
            if done % 500 == 0:
                print('copertura suolo', done, '/', len(jobs), flush=True)
    np.savez_compressed(out, lc=mos, lon0=lon_tiles[0], lat1=top, res=res)
    print('copertura suolo', mos.shape)


if __name__ == '__main__':
    vector()
    elevation()
    landcover()
