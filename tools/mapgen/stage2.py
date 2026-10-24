"""Seconda fase del generatore: attributi delle province e degli stati, vettorializzazione
dei confini e scrittura di game/js/map-data.js. Chiamata da build_map.py."""
import json, math, os, subprocess
import numpy as np
from scipy import ndimage
from shapely.geometry import shape, LineString, Point, Polygon, MultiPolygon, mapping
from shapely.strtree import STRtree
import rasterio.features

from tables import *

# Nomi italiani (o del 1936) delle citta' principali
CITY_NAMES = {
    'London': 'Londra', 'Paris': 'Parigi', 'Moscow': 'Mosca', 'Warsaw': 'Varsavia', 'Rome': 'Roma',
    'Berlin': 'Berlino', 'Vienna': 'Vienna', 'Prague': 'Praga', 'Budapest': 'Budapest',
    'Bucharest': 'Bucarest', 'Belgrade': 'Belgrado', 'Sofia': 'Sofia', 'Athens': 'Atene',
    'Ankara': 'Ankara', 'Istanbul': 'Istanbul', 'Lisbon': 'Lisbona', 'Madrid': 'Madrid',
    'Brussels': 'Bruxelles', 'Amsterdam': 'Amsterdam', 'The Hague': "L'Aia", 'Copenhagen': 'Copenaghen',
    'Oslo': 'Oslo', 'Stockholm': 'Stoccolma', 'Helsinki': 'Helsinki', 'Tallinn': 'Tallinn',
    'Riga': 'Riga', 'Vilnius': 'Wilno', 'Kaunas': 'Kaunas', 'Bern': 'Berna', 'Dublin': 'Dublino',
    'Reykjavik': 'Reykjavík', 'Cairo': 'Il Cairo', 'Baghdad': 'Baghdad', 'Tehran': 'Teheran',
    'Munich': 'Monaco di Baviera', 'Cologne': 'Colonia', 'Hamburg': 'Amburgo', 'Frankfurt': 'Francoforte',
    'Nuremberg': 'Norimberga', 'Dresden': 'Dresda', 'Leipzig': 'Lipsia', 'Hanover': 'Hannover',
    'Gdansk': 'Danzica', 'Gdańsk': 'Danzica', 'Wroclaw': 'Breslavia', 'Wrocław': 'Breslavia',
    'Szczecin': 'Stettino', 'Kaliningrad': 'Königsberg', 'Poznan': 'Posen', 'Poznań': 'Posen',
    'Krakow': 'Cracovia', 'Kraków': 'Cracovia', 'Lviv': 'Leopoli', "L'viv": 'Leopoli', 'Kiev': 'Kiev',
    'Kyiv': 'Kiev', 'Saint Petersburg': 'Leningrado', 'St. Petersburg': 'Leningrado',
    'Volgograd': 'Stalingrado', 'Donetsk': 'Stalino', 'Samara': 'Kujbyšev', 'Nizhny Novgorod': "Gor'kij",
    'Yekaterinburg': 'Sverdlovsk', 'Tver': 'Kalinin', 'Dnipro': 'Dnepropetrovsk',
    'Dnipropetrovsk': 'Dnepropetrovsk', 'Kharkiv': "Char'kov", 'Odesa': 'Odessa', 'Odessa': 'Odessa',
    'Chisinau': 'Chișinău', 'Milan': 'Milano', 'Naples': 'Napoli', 'Turin': 'Torino', 'Genoa': 'Genova',
    'Florence': 'Firenze', 'Venice': 'Venezia', 'Lyon': 'Lione', 'Marseille': 'Marsiglia',
    'Seville': 'Siviglia', 'Barcelona': 'Barcellona', 'Valencia': 'Valencia', 'Algiers': 'Algeri',
    'Tunis': 'Tunisi', 'Tripoli': 'Tripoli', 'Alexandria': 'Alessandria', 'Jerusalem': 'Gerusalemme',
    'Damascus': 'Damasco', 'Beirut': 'Beirut', 'Antwerpen': 'Anversa', 'Antwerp': 'Anversa',
    'Gothenburg': 'Göteborg', 'Göteborg': 'Göteborg', 'Thessaloniki': 'Salonicco', 'Izmir': 'Smirne',
    'Zagreb': 'Zagabria', 'Ljubljana': 'Lubiana', 'Rijeka': 'Fiume', 'Zadar': 'Zara', 'Bratislava': 'Bratislava',
    'Brno': 'Brno', 'Minsk': 'Minsk', 'Tbilisi': 'Tbilisi', 'Baku': 'Baku', 'Yerevan': 'Erevan',
    'Rostov': 'Rostov sul Don', 'Kazan': 'Kazan', 'Tirana': 'Tirana', 'Luxembourg': 'Lussemburgo',
    'Edinburgh': 'Edimburgo', 'Kaunas': 'Kaunas', 'Valletta': 'La Valletta', 'Nicosia': 'Nicosia',
    'Casablanca': 'Casablanca', 'Rabat': 'Rabat', 'Riyadh': 'Riad', 'Kuwait': 'Kuwait',
    'Benghazi': 'Bengasi', 'Klaipeda': 'Memel', 'Klaipėda': 'Memel', 'Chernivtsi': 'Cernăuți',
    'Uzhgorod': 'Užhorod', 'Cluj-Napoca': 'Cluj', 'Bialystok': 'Białystok', 'Opole': 'Oppeln',
    'Katowice': 'Katowice', 'Gliwice': 'Gleiwitz', 'Olsztyn': 'Allenstein', 'Zaporizhzhya': 'Zaporož\'e',
    'Mariupol': 'Mariupol\'', 'Kryvyy Rih': 'Krivoj Rog', 'Luhansk': 'Vorošilovgrad',
    'Vyborg': 'Viipuri', 'Koszalin': 'Köslin', 'Zielona Gora': 'Grünberg', 'Zielona Góra': 'Grünberg',
    'Gorzow Wielkopolski': 'Landsberg', 'Gorzów Wielkopolski': 'Landsberg', 'Legnica': 'Liegnitz',
    'Walbrzych': 'Waldenburg', 'Wałbrzych': 'Waldenburg', 'Slupsk': 'Stolp', 'Słupsk': 'Stolp',
    'Elblag': 'Elbing', 'Elbląg': 'Elbing', 'Jelenia Gora': 'Hirschberg', 'Jelenia Góra': 'Hirschberg',
    'Sovetsk': 'Tilsit', 'Chernyakhovsk': 'Insterburg', 'Zabrze': 'Hindenburg', 'Bytom': 'Beuthen',
    'Pskov': 'Pskov', 'Oulu': 'Oulu', 'Sortavala': 'Sortavala', 'Sevastopol': 'Sebastopoli', 'Murmansk': 'Murmansk', 'Arkhangelsk': 'Arcangelo',
}

DEV_TERRAIN_ORDER = ['plains', 'forest', 'hills', 'mountain', 'desert', 'marsh', 'urban']


def run(G, land, lake, ctry, adm, adm_feats, st, smeta, prov, pstate, sreg, sregmeta):
    say, to_px, load, H, W, KM, CACHE = G['say'], G['to_px'], G['load'], G['H'], G['W'], G['KM'], G['CACHE']
    PX_KM2 = KM * KM
    CODES = G['CODES']
    N = int(prov.max())
    NL = sum(1 for p in pstate if p[0] == 'L')
    ids = np.arange(1, N + 1)
    lon, lat = G['pixel_lonlat']()

    # ---------- geometria di base ----------
    say('statistiche delle province')
    area_px = np.bincount(prov.ravel(), minlength=N + 1)[1:].astype(float)
    bnd = np.zeros((H, W), bool)
    bnd[:, 1:] |= prov[:, 1:] != prov[:, :-1]
    bnd[:, :-1] |= prov[:, 1:] != prov[:, :-1]
    bnd[1:, :] |= prov[1:, :] != prov[:-1, :]
    bnd[:-1, :] |= prov[1:, :] != prov[:-1, :]
    dt = ndimage.distance_transform_edt(~bnd)
    lp = ndimage.maximum_position(dt, prov, ids)  # punto piu' interno: etichette e segnalini
    label_pt = [(c + 0.5, r + 0.5) for r, c in lp]
    adj = G['neighbors_pairs'](prov)

    # ---------- terreno ----------
    say('terreno da rilievo e copertura del suolo')
    z = np.load(os.path.join(G['DATA'], 'elev_z6.npz'))
    elev, ez, ex0, ey0 = z['elev'], int(z['z']), int(z['x0']), int(z['y0'])
    n = 2 ** ez
    mx = (((lon + 180) / 360 * n) - ex0) * 256
    latr = np.radians(np.clip(lat, -85, 85))
    my = (((1 - np.arcsinh(np.tan(latr)) / math.pi) / 2 * n) - ey0) * 256
    eg = ndimage.map_coordinates(elev, [my.ravel(), mx.ravel()], order=1, mode='nearest').reshape(H, W)
    eg = np.maximum(eg, 0)
    gy, gx = np.gradient(eg, KM)  # metri per km
    slope = np.hypot(gx, gy)
    z = np.load(os.path.join(G['DATA'], 'landcover.npz'))
    lc, lon0, lat1, res = z['lc'], float(z['lon0']), float(z['lat1']), float(z['res'])
    ri = np.clip(((lat1 - lat) / res).astype(int), 0, lc.shape[0] - 1)
    ci = np.clip(((lon - lon0) / res).astype(int), 0, lc.shape[1] - 1)
    lcg = lc[ri, ci]
    # classi WorldCover: 10 alberi 20 arbusti 30 prati 40 coltivi 50 urbano 60 nudo 70 neve 80 acqua 90 palude 95 mangrovie 100 muschi
    def frac(mask):
        return np.bincount(prov.ravel(), weights=mask.ravel().astype(float), minlength=N + 1)[1:] / np.maximum(area_px, 1)
    f_tree, f_built, f_bare = frac(lcg == 10), frac(lcg == 50), frac(lcg == 60)
    f_wet, f_shrub, f_snow = frac(lcg == 90), frac(lcg == 20), frac(lcg == 70)
    m_elev = ndimage.mean(eg, prov, ids)
    m_slope = ndimage.mean(slope, prov, ids)
    p_slope = ndimage.maximum(ndimage.uniform_filter(slope, 5), prov, ids)
    built_px = np.bincount(prov.ravel(), weights=(lcg == 50).ravel().astype(float), minlength=N + 1)[1:]
    terrain = []
    for i in range(N):
        if i >= NL:
            terrain.append('sea')
            continue
        s, e = m_slope[i], m_elev[i]
        if f_built[i] > 0.16 and area_px[i] * PX_KM2 < 6000:
            t = 'urban'
        elif s > 95 or (s > 70 and e > 900):
            t = 'mountain'
        elif f_bare[i] + 0.5 * f_shrub[i] > 0.55:
            t = 'desert'
        elif s > 38 or e > 1100:
            t = 'hills'
        elif f_wet[i] > 0.10:
            t = 'marsh'
        elif f_tree[i] > 0.48:
            t = 'forest'
        else:
            t = 'plains'
        terrain.append(t)
    from collections import Counter
    say('terreni', Counter(terrain[:NL]))

    # ---------- province: tipo, stato, costa ----------
    is_land = np.array([p[0] == 'L' for p in pstate])
    pst = np.array([p[1] - 1 for p in pstate])  # indice stato (terra) o regione marina (mare), da 0
    nbs = [dict() for _ in range(N)]
    for (a, b), L in adj.items():
        nbs[a - 1][b - 1] = L
        nbs[b - 1][a - 1] = L
    coastal = [bool(is_land[i] and any(not is_land[j] for j in nbs[i])) for i in range(N)]
    owner_p = [smeta[pst[i]]['owner'] if is_land[i] else None for i in range(N)]

    def nearest_prov(lo, la, want_land=True, coastal_only=False, maxd=40):
        x, y = to_px(lo, la)
        x, y = float(x), float(y)
        best, bd = -1, 1e18
        r0, c0 = int(y), int(x)
        for rad in (0, 2, 5, 10, 20, maxd):
            r1, r2 = max(0, r0 - rad), min(H, r0 + rad + 1)
            c1, c2 = max(0, c0 - rad), min(W, c0 + rad + 1)
            if r1 >= r2 or c1 >= c2:
                return -1
            win = prov[r1:r2, c1:c2]
            for v in np.unique(win):
                if v == 0:
                    continue
                i = v - 1
                if is_land[i] != want_land or (coastal_only and not coastal[i]):
                    continue
                rr, cc = np.nonzero(win == v)
                d = ((rr + r1 + 0.5 - y) ** 2 + (cc + c1 + 0.5 - x) ** 2).min()
                if d < bd:
                    best, bd = i, d
            if best >= 0:
                return best
        return -1

    # ---------- citta' e punti vittoria ----------
    say('citta\'')
    cities = []
    vp = [0] * N
    city_of = [None] * N
    pop_city = np.zeros(N)
    feats = load('ne_10m_populated_places_simple')
    for f in feats:
        p = f['properties']
        lo, la = p['longitude'], p['latitude']
        if not (-45 < lo < 80 and 18 < la < 82):
            continue
        x, y = to_px(lo, la)
        if not (0 <= x < W and 0 <= y < H):
            continue
        i = nearest_prov(lo, la, maxd=8)
        if i < 0:
            continue
        pop = p['pop_max'] or 0
        pop_city[i] += pop
        nm = CITY_NAMES.get(p['name'], CITY_NAMES.get(p['nameascii'], p['name']))
        v = 0
        if pop >= 2_000_000:
            v = 15
        elif pop >= 1_000_000:
            v = 10
        elif pop >= 500_000:
            v = 5
        elif pop >= 200_000:
            v = 3
        elif pop >= 90_000 or p['featurecla'] == 'Admin-1 capital' and pop >= 40_000:
            v = 1
        if v > vp[i]:
            vp[i] = v
            city_of[i] = nm
        cities.append((pop, nm, i, lo, la))
    # capitali
    countries = {}
    for code, (nm, (lo, la), cls) in COUNTRIES.items():
        i = nearest_prov(lo, la, maxd=60)
        if i < 0 or owner_p[i] != code:
            # capitale fuori mappa o fuori dal territorio: la citta' piu' grande del paese
            cand = [c for c in cities if owner_p[c[2]] == code]
            if not cand:
                own = [k for k in range(NL) if owner_p[k] == code]
                if not own:
                    continue
                i = max(own, key=lambda k: area_px[k])
            else:
                i = max(cand)[2]
        major = code in ('G', 'F', 'U', 'I', 'S')
        vp[i] = max(vp[i], 30 if major else 15)
        cap_name = CAPITAL_CITY.get(code)
        if cap_name or not city_of[i]:
            best = [c for c in cities if c[2] == i]
            city_of[i] = cap_name or (max(best)[1] if best else nm)
        countries[code] = dict(name=nm, capital=int(i))
    say(len(countries), 'paesi;', sum(1 for v in vp if v), 'province con punti vittoria')

    # ---------- porti ----------
    port = [0] * N
    for f in load('ne_10m_ports'):
        lo, la = f['geometry']['coordinates']
        i = nearest_prov(lo, la, coastal_only=True, maxd=10)
        if i >= 0:
            port[i] = max(port[i], 1 if (f['properties'].get('scalerank') or 9) > 6 else 2)
    for lo, la, lvl, nm in NAVAL_BASES:
        i = nearest_prov(lo, la, coastal_only=True, maxd=15)
        if i >= 0:
            port[i] = max(port[i], lvl)

    # ---------- ferrovie ----------
    say('ferrovie')
    rail_cnt = {}
    for k, f in enumerate(load('ne_10m_railroads')):
        g = f['geometry']
        if not g:
            continue
        lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
        for ln in lines:
            a = np.array(ln)
            if not ((a[:, 0] > -40) & (a[:, 0] < 75) & (a[:, 1] > 20)).any():
                continue
            xs, ys = to_px(a[:, 0], a[:, 1])
            pts = []
            for j in range(len(xs) - 1):
                d = math.hypot(xs[j + 1] - xs[j], ys[j + 1] - ys[j])
                m = max(1, int(d / 0.6))
                t = np.linspace(0, 1, m, endpoint=False)
                pts.append(np.stack([xs[j] + (xs[j + 1] - xs[j]) * t, ys[j] + (ys[j + 1] - ys[j]) * t], 1))
            if not pts:
                continue
            pts = np.concatenate(pts)
            c = pts[:, 0].astype(int)
            r = pts[:, 1].astype(int)
            ok = (c >= 0) & (c < W) & (r >= 0) & (r < H)
            seq = prov[r[ok], c[ok]]
            prev = 0
            seen = set()
            for v in seq:
                if v == 0 or not is_land[v - 1]:
                    continue
                if prev and v != prev and (v - 1) in nbs[prev - 1]:
                    e = (min(prev, v) - 1, max(prev, v) - 1)
                    if e not in seen:
                        seen.add(e)
                        rail_cnt[e] = rail_cnt.get(e, 0) + 1
                prev = v
    rails = []
    rail_p = [0] * N
    for (a, b), c in rail_cnt.items():
        dev = min(DEV.get(owner_p[a], 0.3), DEV.get(owner_p[b], 0.3))
        lvl = 1 + (c >= 2) + (c >= 4) + (dev >= 0.75 and c >= 2)
        if vp[a] >= 10 or vp[b] >= 10:
            lvl += 1
        lvl = int(min(5, lvl))
        rails.append([a, b, lvl])
        rail_p[a] = max(rail_p[a], lvl)
        rail_p[b] = max(rail_p[b], lvl)
    say(len(rails), 'tratte ferroviarie')

    # ---------- fiumi ----------
    say('fiumi')
    rivers = []
    rgeoms = []
    for f in load('ne_10m_rivers_lake_centerlines'):
        p = f['properties']
        if p.get('featurecla') not in ('River', 'Lake Centerline') or not f['geometry']:
            continue
        sr = p.get('scalerank') or 10
        if sr > 7:
            continue
        g = shape(f['geometry'])
        if not g.intersects(G['CLIP']):
            continue
        gp = G['geom_px'](g)
        if gp.is_empty:
            continue
        parts = [gp] if gp.geom_type == 'LineString' else list(getattr(gp, 'geoms', []))
        for part in parts:
            if part.geom_type != 'LineString' or part.length < 4:
                continue
            part = part.simplify(0.6)
            rgeoms.append(part)
            w = 3 if sr <= 3 else 2 if sr <= 5 else 1
            rivers.append(dict(w=w, name=p.get('name') or '', pts=[round(v, 1) for xy in part.coords for v in xy]))
    tree = STRtree(rgeoms)
    river_edge = set()
    for (a, b) in adj:
        i, j = a - 1, b - 1
        if not (is_land[i] and is_land[j]):
            continue
        seg = LineString([label_pt[i], label_pt[j]])
        for k in tree.query(seg):
            if rgeoms[k].intersects(seg):
                river_edge.add((i, j))
                break
    say(len(rivers), 'fiumi,', len(river_edge), 'confini fluviali')

    # ---------- stretti ----------
    straits = []
    for (a, b, nm) in STRAITS:
        i = nearest_prov(*a, maxd=12)
        j = nearest_prov(*b, maxd=12)
        if i >= 0 and j >= 0 and i != j and j not in nbs[i]:
            straits.append([i, j, nm])
            nbs[i][j] = 0
            nbs[j][i] = 0

    # ---------- stati ----------
    say('stati: popolazione, infrastrutture, risorse')
    NS = len(smeta)
    st_prov = [[] for _ in range(NS)]
    for i in range(NL):
        st_prov[pst[i]].append(i)
    weight = np.zeros(NS)
    st_built = np.zeros(NS)
    st_area = np.zeros(NS)
    for s in range(NS):
        ps = st_prov[s]
        st_area[s] = sum(area_px[i] for i in ps) * PX_KM2
        st_built[s] = sum(built_px[i] for i in ps)
        weight[s] = st_built[s] * 3 + sum(pop_city[i] for i in ps) / 4000 + st_area[s] / 400
    st_pop = np.zeros(NS)
    by_adm0, by_owner = {}, {}
    for s, m in enumerate(smeta):
        if m['adm0'] in POP_COLONY:
            by_adm0.setdefault(m['adm0'], []).append(s)
        else:
            by_owner.setdefault(m['owner'], []).append(s)
    for key, ss in list(by_adm0.items()) + list(by_owner.items()):
        tot = POP_COLONY.get(key, POP_1936.get(key, 1.0)) * 1e6
        ws = weight[ss].sum() or 1
        for s in ss:
            st_pop[s] = tot * weight[s] / ws
    res_st = [dict() for _ in range(NS)]
    for lo, la, r, amt in RESOURCES:
        i = nearest_prov(lo, la, maxd=25)
        if i >= 0 and is_land[i] and amt > 0:
            s = pst[i]
            res_st[s][r] = res_st[s].get(r, 0) + amt
    states = []
    for s, m in enumerate(smeta):
        ps = st_prov[s]
        if not ps:
            states.append(None)
            continue
        dev = DEV.get(m['owner'], 0.3)
        railfrac = sum(1 for i in ps if rail_p[i]) / len(ps)
        builtf = st_built[s] / max(1, sum(area_px[i] for i in ps))
        infra = int(max(1, min(5, round(1 + 4 * (0.5 * dev + 0.3 * railfrac + 0.2 * min(1, builtf * 8))))))
        pop = st_pop[s]
        cats = [(0.1e6, 'pastorale', 1), (0.5e6, 'rurale', 2), (1e6, 'cittadina', 4), (2e6, 'grande cittadina', 5),
                (3.5e6, 'città', 6), (5e6, 'grande città', 8), (8e6, 'metropoli', 10), (1e18, 'megalopoli', 12)]
        cat, slots = next((c, sl) for lim, c, sl in cats if pop < lim)
        if pop < 0.05e6 and st_area[s] > 30000:
            cat, slots = 'deserto', 0
        capital = max(ps, key=lambda i: (vp[i], pop_city[i], built_px[i], area_px[i]))
        states.append(dict(name=m['name'], owner=m['owner'], provinces=ps, capital=int(capital),
                           manpower=int(round(pop, -3)), infra=infra, category=cat, slots=slots,
                           industry=round(float(st_built[s] * PX_KM2 * dev), 1),
                           resources=res_st[s], area=int(st_area[s])))
    # rinumera eliminando stati vuoti
    keep = [s for s in range(NS) if states[s]]
    remap = {s: k for k, s in enumerate(keep)}
    states = [states[s] for s in keep]
    pst = np.array([remap[pst[i]] if is_land[i] else pst[i] for i in range(N)])

    # hub logistici: capoluogo di ogni stato collegato alla rete ferroviaria + capitali
    hub = [False] * N
    for s in states:
        if rail_p[s['capital']]:
            hub[s['capital']] = True
    for c in countries.values():
        hub[c['capital']] = True

    # ---------- regioni strategiche ----------
    say('regioni strategiche')
    sc = np.array([[np.mean([label_pt[i][0] for i in s['provinces']]),
                    np.mean([label_pt[i][1] for i in s['provinces']])] for s in states])
    sa = np.array([s['area'] for s in states], float)
    k = max(8, int(round(sa.sum() / 230000)))
    cent = G['kmeans'](np.repeat(sc, np.maximum(1, (sa / 5000).astype(int)), 0), k)
    lab = G['assign'](sc, cent)
    regions = []
    reg_of_state = np.zeros(len(states), int)
    own_cent = {}
    for code in countries:
        m = [i for i, s in enumerate(states) if s['owner'] == code]
        if m:
            own_cent[code] = (np.average(sc[m], axis=0, weights=sa[m]), len(set(lab[m])))
    used_names = {}
    for r in range(k):
        m = [i for i in range(len(states)) if lab[i] == r]
        if not m:
            continue
        # come in HOI4 la regione prende il nome dalla sua area principale
        lead = max(m, key=lambda i: states[i]['manpower'] + states[i]['area'] * 20)
        nm = states[lead]['name']
        used_names[nm] = used_names.get(nm, 0) + 1
        if used_names[nm] > 1:
            nm = f'{nm} {used_names[nm]}'
        for i in m:
            reg_of_state[i] = len(regions)
        regions.append(dict(name=nm, sea=False, states=m))
    sea_base = len(regions)
    for r, m in enumerate(sregmeta):
        regions.append(dict(name=m['name'], sea=True, provinces=[]))
    prov_region = [0] * N
    for i in range(N):
        if is_land[i]:
            prov_region[i] = int(reg_of_state[pst[i]])
        else:
            prov_region[i] = sea_base + int(pst[i])
            regions[prov_region[i]]['provinces'].append(i)
    for i, s in enumerate(states):
        s['region'] = int(reg_of_state[i])
    regions_used = [r for r in regions if r.get('states') or r.get('provinces')]
    rmap = {id(r): k for k, r in enumerate(regions_used)}
    old2new = {k: rmap[id(r)] for k, r in enumerate(regions) if id(r) in rmap}
    for s in states:
        s['region'] = old2new[s['region']]
    prov_region = [old2new[r] for r in prov_region]
    regions = regions_used
    say(sum(1 for r in regions if not r['sea']), 'regioni terrestri,', sum(1 for r in regions if r['sea']), 'marittime')

    # ---------- vettorializzazione ----------
    say('vettorializzo i confini')
    topo = vectorize(prov, N, CACHE, say)

    # ---------- rilievo ombreggiato (texture della mappa) ----------
    relief(eg, land, KM, os.path.join(os.path.dirname(G['OUT_JS']), '..', 'img', 'relief.png'), say)

    # ---------- uscita ----------
    provinces = []
    for i in range(N):
        p = dict(id=i, type='land' if is_land[i] else 'sea', x=round(label_pt[i][0], 1),
                 y=round(label_pt[i][1], 1), area=int(area_px[i] * PX_KM2), terrain=terrain[i],
                 region=prov_region[i], rings=topo['rings'][i])
        if is_land[i]:
            p['state'] = int(pst[i])
            if coastal[i]:
                p['coastal'] = True
            if vp[i]:
                p['vp'] = vp[i]
            if city_of[i]:
                p['city'] = city_of[i]
            if port[i]:
                p['port'] = port[i]
            if rail_p[i]:
                p['rail'] = rail_p[i]
            if hub[i]:
                p['hub'] = True
            p['elev'] = int(m_elev[i])
        provinces.append(p)
    adjl = []
    for (a, b), L in sorted(adj.items()):
        i, j = a - 1, b - 1
        flag = 1 if (i, j) in river_edge or (j, i) in river_edge else 0
        adjl.append([i, j, int(L * KM), flag])
    for i, j, nm in straits:
        adjl.append([i, j, 0, 2])
    data = dict(
        version=1, year=1936, name='Europa e Mediterraneo 1936', projection=G['PROJ'],
        kmPerUnit=KM, width=W, height=H, quant=topo['quant'],
        countries=countries, states=states, regions=regions, provinces=provinces,
        adjacency=adjl, straits=[[i, j, nm] for i, j, nm in straits], railways=rails,
        rivers=rivers, arcs=topo['arcs'], arcSides=topo['sides'],
        sources=['historical-basemaps (aourednik, GPL-3.0): confini 1938 corretti al 1936',
                 'Natural Earth 10m (pubblico dominio)', 'Mapzen/AWS Terrain Tiles',
                 'ESA WorldCover 2021 (CC-BY 4.0)'],
    )
    js = ('// File generato da tools/mapgen/build_map.py: non modificarlo a mano.\n'
          '// Modello dati documentato in docs/MAPPA.md\n'
          "'use strict';\nconst MAP_DATA = " + json.dumps(data, ensure_ascii=False, separators=(',', ':'), default=lambda o: o.item()) + ';\n')
    out = G['OUT_JS']
    with open(out, 'w', encoding='utf-8') as f:
        f.write(js)
    say('scritto', out, f'{len(js) / 1e6:.2f} MB', N, 'province', len(states), 'stati')


def relief(eg, land, KM, out, say):
    """Ombreggiatura del rilievo in scala di grigi (128 = pianura) con alfa solo sulle terre."""
    from PIL import Image
    e = ndimage.gaussian_filter(eg, 0.7)
    gy, gx = np.gradient(e * 2.2, KM * 1000)
    az, alt = math.radians(315), math.radians(42)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    flat = math.sin(alt)
    v = 128 + (hs - flat) * 420
    v = np.clip(v, 0, 255)
    v = (np.round(v / 6) * 6).clip(0, 255).astype(np.uint8)
    a = np.where(land, 255, 0).astype(np.uint8)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    Image.fromarray(np.dstack([v, a]), 'LA').save(out, optimize=True)
    say('rilievo', out, os.path.getsize(out) // 1024, 'KB')


def vectorize(prov, N, CACHE, say):
    """Confini delle province come archi condivisi (TopoJSON via mapshaper)."""
    gj = os.path.join(CACHE, 'prov.geojson')
    tj = os.path.join(CACHE, 'prov.topojson')
    polys = {}
    for geom, v in rasterio.features.shapes(prov, mask=prov > 0, connectivity=4):
        polys.setdefault(int(v), []).append(geom['coordinates'])
    feats = []
    for v, parts in polys.items():
        feats.append(dict(type='Feature', properties=dict(id=v - 1),
                          geometry=dict(type='MultiPolygon', coordinates=parts)))
    with open(gj, 'w') as f:
        json.dump(dict(type='FeatureCollection', features=feats), f)
    here = os.path.dirname(os.path.abspath(__file__))
    cmd = ['npx', '--yes', 'mapshaper@0.6.102', '-i', gj, '-o', tj, 'format=topojson', 'no-quantization', 'force']
    subprocess.run(cmd, check=True, cwd=here)
    with open(tj) as f:
        t = json.load(f)
    arcs = t['arcs']
    obj = next(iter(t['objects'].values()))
    rings = [[] for _ in range(N)]
    sides = [[-1, -1] for _ in arcs]
    for g in obj['geometries']:
        i = g['properties']['id']
        polys = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]
        for poly in polys:
            for ring in poly:
                rings[i].append(ring)
                for a in ring:
                    k = a if a >= 0 else ~a
                    s = sides[k]
                    if s[0] < 0:
                        s[0] = i
                    elif s[0] != i and s[1] < 0:
                        s[1] = i
    # smussatura (Chaikin) degli archi a scalini, estremi fissi; quantizzazione a 1/4 di unita'
    Q = 4
    out = []
    for a in arcs:
        pts = np.array(a, float)
        for _ in range(2):
            if len(pts) < 3:
                break
            q = 0.75 * pts[:-1] + 0.25 * pts[1:]
            r = 0.25 * pts[:-1] + 0.75 * pts[1:]
            mid = np.empty((2 * (len(pts) - 1), 2))
            mid[0::2] = q
            mid[1::2] = r
            pts = np.vstack([pts[:1], mid[1:-1], pts[-1:]])
        pts = dp(pts, 0.35)
        qi = np.round(pts * Q).astype(int)
        d = np.diff(qi, axis=0)
        flat = qi[0].tolist() + d.ravel().tolist()
        out.append(flat)
    say(len(arcs), 'archi,', sum(len(a) for a in out) // 2, 'vertici')
    return dict(arcs=out, sides=[v for s in sides for v in s], rings=rings, quant=1 / Q)


def dp(pts, tol):
    """Douglas-Peucker iterativo."""
    if len(pts) < 3:
        return pts
    keep = np.zeros(len(pts), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = pts[i], pts[j]
        ab = b - a
        L = np.hypot(*ab)
        seg = pts[i + 1:j]
        if L < 1e-9:
            d = np.hypot(*(seg - a).T)
        else:
            d = np.abs(ab[0] * (seg[:, 1] - a[1]) - ab[1] * (seg[:, 0] - a[0])) / L
        k = int(np.argmax(d))
        if d[k] > tol:
            m = i + 1 + k
            keep[m] = True
            stack += [(i, m), (m, j)]
    return pts[keep]


from collections import Counter
