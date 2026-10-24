#!/usr/bin/env python3
"""Generatore della mappa di Iron Fist (Europa e Mediterraneo, 1936).

Procedura (simile a come e' fatta la mappa di Hearts of Iron IV, che parte da una bitmap
delle province):
 1. rasterizza terre, laghi, confini storici e regioni amministrative su una griglia
    a 2 km/pixel in proiezione azimutale equivalente di Lambert;
 2. ricava i paesi del 1936, li divide in stati (regioni amministrative accorpate o divise)
    e gli stati in province (Voronoi con bordi irregolari);
 3. divide il mare in regioni strategiche e province marittime;
 4. calcola terreno (rilievo + copertura del suolo), citta' e punti vittoria, porti,
    ferrovie, infrastrutture, fiumi, risorse;
 5. vettorializza i confini delle province come archi condivisi (topologia) e scrive
    game/js/map-data.js.

Uso: python3 fetch_data.py && python3 build_map.py
"""
import json, math, os, subprocess, sys, time, warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import shape, box, Point, LineString, Polygon, MultiPolygon, mapping
from shapely.ops import transform as stransform, unary_union
from shapely.strtree import STRtree
from pyproj import Transformer
import rasterio.features
from affine import Affine

from tables import *

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
OUT_JS = os.path.join(HERE, '..', '..', 'game', 'js', 'map-data.js')
CACHE = os.path.join(DATA, 'cache')
os.makedirs(CACHE, exist_ok=True)

PROJ = '+proj=laea +lat_0=52 +lon_0=16 +datum=WGS84 +units=km'
KM = 2.0                                   # km per pixel
X0, X1, Y0, Y1 = -2350, 2900, -2350, 2300  # estensione in km
W, H = int((X1 - X0) / KM), int((Y1 - Y0) / KM)
CLIP = box(-45, 18, 80, 82)
FWD = Transformer.from_crs('EPSG:4326', PROJ, always_xy=True)
INV = Transformer.from_crs(PROJ, 'EPSG:4326', always_xy=True)
PX_KM2 = KM * KM
RNG = np.random.default_rng(1936)
T0 = time.time()


def say(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


def to_px(lon, lat):
    x, y = FWD.transform(lon, lat)
    return (np.asarray(x) - X0) / KM, (Y1 - np.asarray(y)) / KM


def geom_px(g):
    """Geometria lon/lat -> coordinate pixel."""
    g = g.intersection(CLIP) if not CLIP.contains(g) else g
    if g.is_empty:
        return g
    return stransform(lambda x, y, z=None: to_px(x, y), g)


def load(name):
    with open(os.path.join(DATA, name + '.geojson'), encoding='utf-8') as f:
        return json.load(f)['features']


def raster(shapes, dtype=np.int32, fill=0, all_touched=False):
    shapes = [(g, v) for g, v in shapes if g is not None and not g.is_empty]
    if not shapes:
        return np.full((H, W), fill, dtype)
    return rasterio.features.rasterize(shapes, out_shape=(H, W), fill=fill, dtype=dtype,
                                       transform=Affine.identity(), all_touched=all_touched)


def nearest_fill(arr, valid):
    """Riempie le celle non valide con il valore della cella valida piu' vicina."""
    idx = ndimage.distance_transform_edt(~valid, return_distances=False, return_indices=True)
    return arr[idx[0], idx[1]]


def neighbors_pairs(lab):
    """Coppie (a, b, lunghezza bordo) di etichette diverse adiacenti (4-connessione)."""
    out = {}
    for a, b in ((lab[:, :-1], lab[:, 1:]), (lab[:-1, :], lab[1:, :])):
        m = (a != b) & (a > 0) & (b > 0)
        x, y = a[m].astype(np.int64), b[m].astype(np.int64)
        lo, hi = np.minimum(x, y), np.maximum(x, y)
        key = lo * 1_000_000 + hi
        u, c = np.unique(key, return_counts=True)
        for k, n in zip(u.tolist(), c.tolist()):
            out[(k // 1_000_000, k % 1_000_000)] = out.get((k // 1_000_000, k % 1_000_000), 0) + n
    return out


def kmeans(pts, k, iters=12, w=None):
    """K-means semplice (inizializzazione farthest-point) su punti 2D."""
    n = len(pts)
    if k <= 1 or n <= k:
        return np.array([pts.mean(0)]) if k <= 1 else pts[:k].astype(float)
    sample = pts if n <= 30000 else pts[RNG.choice(n, 30000, replace=False)]
    c = [sample[RNG.integers(len(sample))]]
    d = ((sample - c[0]) ** 2).sum(1)
    for _ in range(1, k):
        c.append(sample[int(np.argmax(d))])
        d = np.minimum(d, ((sample - c[-1]) ** 2).sum(1))
    c = np.array(c, float)
    for _ in range(iters):
        lab = assign(sample, c)
        for j in range(k):
            m = lab == j
            if m.any():
                c[j] = sample[m].mean(0)
    return c


def assign(pts, c):
    best = np.zeros(len(pts), np.int32)
    bd = np.full(len(pts), np.inf)
    for j in range(len(c)):
        d = ((pts - c[j]) ** 2).sum(1)
        m = d < bd
        best[m] = j
        bd[m] = d[m]
    return best


# --------------------------------------------------------------------------------------
# 1. terre, laghi, mare
# --------------------------------------------------------------------------------------
def build_land():
    path = os.path.join(CACHE, 'land.npz')
    if os.path.exists(path):
        z = np.load(path)
        return z['land'], z['lake']
    say('rasterizzo terre e laghi')
    land_shapes = [(geom_px(shape(f['geometry'])), 1) for f in load('ne_10m_land') + load('ne_10m_minor_islands')]
    land = raster(land_shapes, np.uint8) > 0
    lakes = []
    for f in load('ne_10m_lakes'):
        p = f['properties']
        nm = str(p.get('name') or '')
        g = shape(f['geometry'])
        if 'Reservoir' in nm or 'Res.' in nm or not g.intersects(CLIP):
            continue  # i bacini artificiali non esistevano nel 1936
        if g.area < 0.01 and nm not in ('Lake Balaton', 'Lake Geneva', 'Lake Constance', 'Lago di Garda',
                                         'Lake Garda', 'Lago Maggiore', 'Lake Neuchâtel', 'Lake Ohrid',
                                         'Lake Prespa', 'Lake Scutari'):
            continue
        lakes.append((geom_px(g), 1))
    lake = raster(lakes, np.uint8) > 0
    land &= ~lake
    # scavo degli stretti navigabili
    for line in SEA_CHANNELS:
        xs, ys = to_px(*zip(*line))
        g = LineString(list(zip(xs, ys))).buffer(0.9)
        m = raster([(g, 1)], np.uint8, all_touched=True) > 0
        land &= ~m
    # i mari chiusi (Caspio e lagune isolate) diventano laghi
    sea = ~land & ~lake
    lab, n = ndimage.label(sea)
    sizes = np.bincount(lab.ravel())
    sizes[0] = 0
    main = int(np.argmax(sizes))
    for i in range(1, n + 1):
        if i != main and sizes[i] < 400_000:
            m = lab == i
            if sizes[i] < 30:
                land |= m  # pozze d'acqua costiere minuscole
            else:
                lake |= m
    # isolotti minuscoli -> mare
    lab, n = ndimage.label(land)
    sizes = np.bincount(lab.ravel())
    tiny = np.where(sizes < 5)[0]
    tiny = tiny[tiny > 0]
    land[np.isin(lab, tiny)] = False
    np.savez_compressed(path, land=land, lake=lake)
    return land, lake


# --------------------------------------------------------------------------------------
# 2. paesi del 1936
# --------------------------------------------------------------------------------------
CODES = list(COUNTRIES.keys())
CODE_ID = {c: i + 1 for i, c in enumerate(CODES)}


def build_admin():
    path = os.path.join(CACHE, 'admin.npz')
    feats = load('ne_10m_admin_1_states_provinces')
    feats = [f for f in feats if f['geometry'] and shape(f['geometry']).intersects(CLIP)]
    if os.path.exists(path):
        return np.load(path)['adm'], feats
    say('rasterizzo', len(feats), 'regioni amministrative')
    adm = raster([(geom_px(shape(f['geometry'])), i + 1) for i, f in enumerate(feats)], np.int32)
    np.savez_compressed(path, adm=adm)
    return adm, feats


def build_countries(land, adm, adm_feats):
    path = os.path.join(CACHE, 'country.npz')
    if os.path.exists(path):
        return np.load(path)['ctry']
    say('confini del 1936')
    hist = []
    for f in load('world_1938'):
        nm = f['properties'].get('NAME')
        if not f['geometry'] or nm not in HIST_NAME:
            continue
        hist.append((geom_px(shape(f['geometry'])), CODE_ID[HIST_NAME[nm]]))
    hr = raster(hist, np.int32)
    # i confini storici del 1938 sono imprecisi: la Germania (che nel 1938 include l'Austria)
    # puo' comparire solo dove c'erano territori tedeschi nel 1936
    a0_of = np.array([''] + [f['properties']['adm0_a3'] for f in adm_feats])
    g_ok = np.isin(a0_of, ['DEU', 'POL', 'RUS'])[adm]
    hr[(hr == CODE_ID['G']) & ~g_ok] = 0
    ctry = np.zeros((H, W), np.int32)
    admf = adm.ravel()
    # regione amministrativa -> paese
    nadm = len(adm_feats) + 1
    hist_votes = np.zeros((nadm, len(CODES) + 1), np.int64)
    m = (adm > 0) & (hr > 0)
    np.add.at(hist_votes, (adm[m], hr[m]), 1)
    adm_code = np.zeros(nadm, np.int32)  # 0 = usa il raster storico pixel per pixel
    for i, f in enumerate(adm_feats):
        p = f['properties']
        a0 = p['adm0_a3']
        if p['adm1_code'] in ADM1_OVERRIDE:
            adm_code[i + 1] = CODE_ID[ADM1_OVERRIDE[p['adm1_code']]]
        elif a0 in DIRECT_ADM0:
            adm_code[i + 1] = CODE_ID[DIRECT_ADM0[a0]]
        else:
            v = hist_votes[i + 1]
            if v.sum() and v.max() >= 0.93 * v.sum():
                adm_code[i + 1] = int(np.argmax(v))
    ctry = adm_code[adm]
    mixed = (ctry == 0) & (hr > 0)
    ctry[mixed] = hr[mixed]
    for code, poly in POLY_OVERRIDE:
        xs, ys = to_px(*zip(*poly))
        m = raster([(Polygon(list(zip(xs, ys))), 1)], np.uint8) > 0
        ctry[m] = CODE_ID[code]
    valid = ctry > 0
    ctry = nearest_fill(ctry, valid)
    ctry[~land] = 0
    np.savez_compressed(path, ctry=ctry)
    return ctry


# --------------------------------------------------------------------------------------
# 3. stati
# --------------------------------------------------------------------------------------
def country_class(code, adm0):
    if adm0 in COLONY_ADM0:
        return 'D'
    return COUNTRIES[code][2]


def build_states(land, ctry, adm, adm_feats):
    path = os.path.join(CACHE, 'states.npz')
    if os.path.exists(path):
        z = np.load(path, allow_pickle=True)
        return z['st'], list(z['meta'])
    say('stati')
    # pezzo = (paese, regione amministrativa)
    key = ctry.astype(np.int64) * 10000 + adm
    key[~land] = 0
    uk, inv = np.unique(key, return_inverse=True)
    piece = inv.reshape(H, W).astype(np.int32)  # 0 = mare (uk[0] == 0)
    assert uk[0] == 0
    npc = len(uk)
    area = np.bincount(piece.ravel(), minlength=npc).astype(float) * PX_KM2
    rows, cols = np.indices((H, W))
    cy = np.bincount(piece.ravel(), weights=rows.ravel(), minlength=npc) / np.maximum(area / PX_KM2, 1)
    cx = np.bincount(piece.ravel(), weights=cols.ravel(), minlength=npc) / np.maximum(area / PX_KM2, 1)
    pc = (uk // 10000).astype(int)
    pa = (uk % 10000).astype(int)
    adj = neighbors_pairs(piece)
    nb = [dict() for _ in range(npc)]
    for (a, b), n in adj.items():
        nb[a][b] = nb[a].get(b, 0) + n
        nb[b][a] = nb[b].get(a, 0) + n

    def pinfo(i):
        f = adm_feats[pa[i] - 1] if pa[i] else None
        code = CODES[pc[i] - 1]
        a0 = f['properties']['adm0_a3'] if f else ''
        return code, a0, f

    # union-find di pezzi
    parent = list(range(npc))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    global SNX, SNY
    SNX, SNY = smooth_noise(10, 6.0), smooth_noise(10, 6.0)
    garea = area.copy()
    target = np.zeros(npc)
    for i in range(1, npc):
        code, a0, f = pinfo(i)
        target[i] = STATE_KM2[country_class(code, a0)]
    region = {}
    for i in range(1, npc):
        code, a0, f = pinfo(i)
        region[i] = (f['properties'].get('region') or '') if f else ''
    # accorpa i pezzi piccoli al vicino dello stesso paese (preferendo la stessa regione)
    changed = True
    while changed:
        changed = False
        order = sorted(range(1, npc), key=lambda i: garea[find(i)])
        for i in order:
            r = find(i)
            if r != i or garea[r] >= 0.5 * target[r]:
                continue
            # vicini del gruppo
            members = [j for j in range(1, npc) if find(j) == r] if garea[r] > 0 else [r]
            cand = {}
            for j in members:
                for k, n in nb[j].items():
                    rk = find(k)
                    if rk == r or pc[k] != pc[r]:
                        continue
                    cand[rk] = cand.get(rk, 0) + n
            if not cand:
                continue
            same_reg = lambda rk: region.get(rk, '') == region.get(r, '') and region.get(r, '')

            def score(rk):
                s = garea[rk] + garea[r]
                if s > 1.6 * target[r]:
                    s *= 3
                if same_reg(rk):
                    s *= 0.6
                return s - cand[rk] * 0.5
            best = min(cand, key=score)
            parent[r] = best
            garea[best] += garea[r]
            changed = True
    # isole e pezzi isolati piccoli: unisci allo stato piu' vicino dello stesso paese
    roots = sorted({find(i) for i in range(1, npc)})
    for r in roots:
        if garea[r] >= 0.15 * target[r]:
            continue
        best, bd = None, 1e18
        for q in roots:
            if q == r or find(q) != q or pc[q] != pc[r] or garea[q] < 0.15 * target[q]:
                continue
            d = (cx[q] - cx[r]) ** 2 + (cy[q] - cy[r]) ** 2
            if d < bd:
                best, bd = q, d
        if best is not None and bd < (300 / KM) ** 2:
            parent[r] = best
            garea[best] += garea[r]
    lut = np.array([find(i) if i else 0 for i in range(npc)], np.int32)
    grp = lut[piece]
    roots = sorted({int(x) for x in np.unique(grp)} - {0})
    # dividi gli stati troppo grandi
    st = np.zeros((H, W), np.int32)
    meta = []
    objs = ndimage.find_objects(grp)
    for r in roots:
        sl = objs[r - 1]
        sub = grp[sl] == r
        rr, cc = np.nonzero(sub)
        rr = rr + sl[0].start
        cc = cc + sl[1].start
        a = len(rr) * PX_KM2
        k = 1
        if a > 2.2 * target[r]:
            k = int(round(a / (1.4 * target[r])))
        members = [j for j in range(1, npc) if lut[j] == r]
        biggest = max(members, key=lambda j: area[j])
        code, a0, f = pinfo(biggest)
        regs = {region[j] for j in members}
        base = clean_name(name_of(f), code) if f else COUNTRIES[code][0]
        if len(members) > 2 and len(regs) == 1 and next(iter(regs)) and len(next(iter(regs))) < 28:
            base = next(iter(regs))
        if k == 1:
            meta.append(dict(name=base, owner=code, adm0=a0, cls=country_class(code, a0)))
            st[rr, cc] = len(meta)
        else:
            pts = np.stack([cc + SNX[rr, cc] * 3, rr + SNY[rr, cc] * 3], 1).astype(float)
            c = kmeans(pts, k)
            lab = assign(pts, c)
            mc = pts.mean(0)
            for j in range(k):
                d = c[j] - mc
                meta.append(dict(name=f'{base} {direction(d[0], -d[1])}', owner=code, adm0=a0,
                                 cls=country_class(code, a0)))
                m = lab == j
                st[rr[m], cc[m]] = len(meta)
    say(len(meta), 'stati')
    np.savez_compressed(path, st=st, meta=np.array(meta, dtype=object))
    return st, meta


def name_of(f):
    p = f['properties']
    for k in ('name_it', 'name', 'gn_name'):
        if p.get(k):
            return p[k]
    return '?'


PREFIXES = ['voivodato della ', 'voivodato delle ', 'voivodato di ', 'voivodato del ', "oblast' di ",
            'oblast di ', "Oblast' di ", 'Oblast di ', 'provincia di ', 'Provincia di ', 'regione di ',
            'Regione di ', 'distretto di ', 'Distretto di ', 'contea di ', 'Contea di ', 'governatorato di ',
            'Governatorato di ', 'Repubblica di ', 'repubblica di ']


def clean_name(nm, code):
    if code == 'G' and nm in GERMAN_EAST:
        return GERMAN_EAST[nm]
    if code == 'K' and nm in FINNISH_EAST:
        return FINNISH_EAST[nm]
    for p in PREFIXES:
        if nm.startswith(p):
            nm = nm[len(p)].upper() + nm[len(p) + 1:]
    return nm


DIRS = ['orientale', 'nord-orientale', 'settentrionale', 'nord-occidentale', 'occidentale',
        'sud-occidentale', 'meridionale', 'sud-orientale']


def direction(dx, dy):
    a = math.degrees(math.atan2(dy, dx)) % 360
    return DIRS[int(((a + 22.5) % 360) // 45)]


# --------------------------------------------------------------------------------------
# 4. province
# --------------------------------------------------------------------------------------
def smooth_noise(sigma, amp):
    n = ndimage.gaussian_filter(RNG.standard_normal((H, W)).astype(np.float32), sigma)
    return n / (n.std() + 1e-9) * amp


def split_regions(lab, nreg, target_px, nx, ny, label_base):
    """Divide ogni regione di 'lab' (1..nreg) in province ~target_px[reg] pixel."""
    out = np.zeros((H, W), np.int32)
    nextid = label_base
    owner = []
    objs = ndimage.find_objects(lab)
    for r in range(1, nreg + 1):
        sl = objs[r - 1] if r - 1 < len(objs) else None
        if sl is None:
            continue
        sub = lab[sl] == r
        rr, cc = np.nonzero(sub)
        n = len(rr)
        k = max(1, int(round(n / target_px[r])))
        rr = rr + sl[0].start
        cc = cc + sl[1].start
        if k == 1:
            out[rr, cc] = nextid
            owner.append(r)
            nextid += 1
            continue
        pts = np.stack([cc + nx[rr, cc], rr + ny[rr, cc]], 1)
        c = kmeans(pts, k)
        a = assign(pts, c)
        for j in range(k):
            m = a == j
            if not m.any():
                continue
            out[rr[m], cc[m]] = nextid
            owner.append(r)
            nextid += 1
    return out, owner


def fix_fragments(prov, parent_lab, min_px=24):
    """Pezzi staccati di una provincia: uniscili alla provincia adiacente della stessa
    regione; le isole lontane restano (province su piu' isole)."""
    ids = np.unique(prov)
    ids = ids[ids > 0]
    objs = ndimage.find_objects(prov)
    for pid in ids:
        sl = objs[pid - 1]
        if sl is None:
            continue
        sl = tuple(slice(max(0, s.start - 1), s.stop + 1) for s in sl)
        sub = prov[sl] == pid
        lab, n = ndimage.label(sub)
        if n <= 1:
            continue
        sizes = np.bincount(lab.ravel())
        sizes[0] = 0
        keep = int(np.argmax(sizes))
        for c in range(1, n + 1):
            if c == keep:
                continue
            m = lab == c
            ring = ndimage.binary_dilation(m) & ~m
            nbv = prov[sl][ring]
            same = parent_lab[sl][ring] == parent_lab[sl][m][0]
            nbv = nbv[(nbv > 0) & (nbv != pid) & same]
            if len(nbv):
                vals, cnt = np.unique(nbv, return_counts=True)
                prov[sl][m] = vals[np.argmax(cnt)]
            elif sizes[c] >= min_px:
                pass  # isola: resta parte della stessa provincia
    return prov


def build_provinces(land, lake, st, smeta):
    path = os.path.join(CACHE, 'prov.npz')
    if os.path.exists(path):
        z = np.load(path, allow_pickle=True)
        return z['prov'], z['pstate'], z['sreg'], list(z['sregmeta'])
    say('province terrestri')
    nx = smooth_noise(6, 5.0)
    ny = smooth_noise(6, 5.0)
    nst = len(smeta)
    tpx = [0] + [PROV_KM2[m['cls']] / PX_KM2 for m in smeta]
    lp, lowner = split_regions(st, nst, tpx, nx, ny, 1)
    lp = fix_fragments(lp, st)
    say('province marittime')
    sreg, sregmeta = sea_regions(land, lake)
    nsr = len(sregmeta)
    tpx = [0] + [(9000 if m['name'] in SEA_ENCLOSED else 30000) / PX_KM2 for m in sregmeta]
    sp, sowner = split_regions(sreg, nsr, tpx, nx * 2, ny * 2, 1)
    sp = fix_fragments(sp, sreg)
    # rinumerazione compatta: prima le terre, poi i mari
    prov = np.zeros((H, W), np.int32)
    pstate = []  # per provincia: ('L', stato) o ('S', regione marina)
    lid = np.unique(lp)
    lid = lid[lid > 0]
    lut = np.zeros(lp.max() + 1, np.int32)
    for i, v in enumerate(lid):
        lut[v] = i + 1
    prov[lp > 0] = lut[lp[lp > 0]]
    stl = ndimage.labeled_comprehension(st, lp, lid, lambda v: np.bincount(v).argmax(), np.int32, 0)
    for v in stl:
        pstate.append(('L', int(v)))
    sid = np.unique(sp)
    sid = sid[sid > 0]
    lut = np.zeros(sp.max() + 1, np.int32)
    base = len(lid)
    for i, v in enumerate(sid):
        lut[v] = base + i + 1
    prov[sp > 0] = lut[sp[sp > 0]]
    srl = ndimage.labeled_comprehension(sreg, sp, sid, lambda v: np.bincount(v).argmax(), np.int32, 0)
    for v in srl:
        pstate.append(('S', int(v)))
    say(len(lid), 'province terrestri,', len(sid), 'marittime')
    pstate = np.array(pstate, dtype=object)
    np.savez_compressed(path, prov=prov, pstate=pstate, sreg=sreg, sregmeta=np.array(sregmeta, dtype=object))
    return prov, list(pstate), sreg, sregmeta


def sea_regions(land, lake):
    sea = ~land & ~lake
    feats = load('ne_10m_geography_marine_polys')
    shapes = []
    names = []
    for f in sorted(feats, key=lambda f: -(f['properties'].get('scalerank') or 0)):
        nm = f['properties'].get('name')
        if nm not in SEA_NAMES or not f['geometry']:
            continue
        g = shape(f['geometry'])
        if not g.intersects(CLIP):
            continue
        it = SEA_NAMES[nm]
        if it not in names:
            names.append(it)
        shapes.append((geom_px(g), names.index(it) + 1))
    # l'oceano per primo (scalerank 0) cosi' i mari interni lo coprono
    shapes.sort(key=lambda s: 0 if names[s[1] - 1] == 'Oceano Atlantico' else 1)
    r = raster(shapes, np.int32)
    # Mediterraneo diviso in tre bacini secondo la longitudine
    lon, lat = pixel_lonlat()
    med = load('ne_10m_geography_marine_polys')
    medg = [shape(f['geometry']) for f in med if f['properties'].get('name') == 'Mediterranean Sea']
    mr = raster([(geom_px(g), 1) for g in medg], np.uint8) > 0
    mr &= (r == 0) | (r == names.index('Oceano Atlantico') + 1 if 'Oceano Atlantico' in names else False)
    for nm, lo, hi in (('Mediterraneo occidentale', -10, 9.5), ('Mediterraneo centrale', 9.5, 21),
                       ('Mediterraneo orientale', 21, 40)):
        names.append(nm)
        r[mr & (lon >= lo) & (lon < hi)] = len(names)
    # Atlantico diviso per latitudine
    if 'Oceano Atlantico' in names:
        ai = names.index('Oceano Atlantico') + 1
        names[ai - 1] = 'Atlantico centrale'
        for nm, lo, hi in (('Atlantico settentrionale', 52, 90), ('Atlantico meridionale', 0, 41)):
            names.append(nm)
            r[(r == ai) & (lat >= lo) & (lat < hi)] = len(names)
    r[~sea] = 0
    r = nearest_fill(r, r > 0)
    r[~sea] = 0
    # rinumera in modo compatto
    used = [i for i in range(1, len(names) + 1) if (r == i).any()]
    lut = np.zeros(len(names) + 1, np.int32)
    meta = []
    for i, u in enumerate(used):
        lut[u] = i + 1
        meta.append(dict(name=names[u - 1]))
    r = lut[r]
    # spezza le regioni non connesse (es. Atlantico ai due lati delle isole britanniche resta unito)
    return r, meta


_LL = None


def pixel_lonlat():
    global _LL
    if _LL is None:
        path = os.path.join(CACHE, 'lonlat.npz')
        if os.path.exists(path):
            z = np.load(path)
            _LL = z['lon'], z['lat']
        else:
            cols, rows = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
            x = X0 + cols * KM
            y = Y1 - rows * KM
            lon, lat = INV.transform(x.ravel(), y.ravel())
            _LL = (np.asarray(lon, np.float32).reshape(H, W), np.asarray(lat, np.float32).reshape(H, W))
            np.savez_compressed(path, lon=_LL[0], lat=_LL[1])
    return _LL


if __name__ == '__main__':
    land, lake = build_land()
    say('terra', int(land.sum()), 'pixel; laghi', int(lake.sum()))
    adm, adm_feats = build_admin()
    ctry = build_countries(land, adm, adm_feats)
    st, smeta = build_states(land, ctry, adm, adm_feats)
    prov, pstate, sreg, sregmeta = build_provinces(land, lake, st, smeta)
    import stage2
    stage2.run(globals(), land, lake, ctry, adm, adm_feats, st, smeta, prov, pstate, sreg, sregmeta)
