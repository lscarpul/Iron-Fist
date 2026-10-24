# La mappa di Iron Fist

La mappa è fatta come quella di Hearts of Iron IV: **province** reali raggruppate in **stati**,
e stati e mari raggruppati in **regioni strategiche**. Copre **il mondo intero** (dal 57°S
all'80°N, Antartide esclusa) con i confini del 1° gennaio 1936.

| | |
|---|---|
| Province | 13503 (9156 terrestri, 4347 marittime) |
| Stati | 1542 |
| Regioni strategiche | 220 terrestri, 164 marittime |
| Paesi | 82 (colonie incluse nei paesi che le possiedono) |
| Proiezione | cilindrica di Miller, meridiano centrale 11°E, giunzione sullo stretto di Bering (169°W) |
| Scala | 1 unità della mappa = 4 km all'equatore (`kmPerUnit`), di più verso i poli: per le distanze usa `provDistKm`, `mapEdge().len` e `tile.area`, che sono già in km reali |
| Bordo | la mappa si richiude in orizzontale (`MAP_DATA.wrapX`): la colonna 0 confina con l'ultima, e le province ai due lati della giunzione sono adiacenti in `nb` |

La densità delle province segue quella di HOI4: fitte in Europa e Giappone (2.600-4.200 km²),
più larghe in Asia, Americhe e Africa (7.000-16.000 km²), enormi in Siberia, Artico, Sahara e
Groenlandia (fino a 45.000 km²).

## File

| File | Cosa contiene |
|---|---|
| `game/js/map-data.js` | `MAP_DATA`: tutti i dati della mappa (generato, non modificarlo a mano) |
| `game/img/relief.png` | rilievo ombreggiato usato come texture (generato) |
| `game/js/map.js` | `buildMap()` crea le tile di gioco dalle province; oggetto `MAP` con stati, regioni e archi |
| `game/js/render.js` | disegno vettoriale delle province, modalità mappa, `Render.overlays` |
| `tools/mapgen/` | generatore in Python: `fetch_data.py` scarica i dati, `build_map.py` genera la mappa |

Per rigenerare la mappa (serve Python 3 con numpy, scipy, shapely, pyproj, rasterio, pillow e Node per `npx mapshaper`):

```sh
cd tools/mapgen
python3 fetch_data.py   # una volta sola: ~200 MB in tools/mapgen/data (ignorata da git)
python3 build_map.py    # ~15 minuti la prima volta (cache in data/cache), ~3 minuti dopo; serve ~12 GB di RAM
```

Le tabelle storiche (codici dei paesi, confini da correggere, capitali, popolazione 1936,
livello di sviluppo, basi navali, stretti, giacimenti) sono in `tools/mapgen/tables.py`.

## Uso nel gioco

Ogni provincia è una tile: `S.tiles[i]` ha lo stesso indice della provincia `MAP_DATA.provinces[i]`.
Il codice esistente su tile (`land`, `owner`, `ctrl`, `terrain`, `vp`, `nb`, `coastal`, `cx`, `cy`)
funziona senza cambiamenti.

### Campi di una tile (`S.tiles[i]`)

| Campo | Tipo | Significato |
|---|---|---|
| `i` | int | indice = id della provincia |
| `land` | bool | provincia terrestre (false = mare) |
| `owner`, `ctrl` | codice | proprietario e controllore (`null` in mare) |
| `terrain` | string | `plains`, `forest`, `hills`, `mountain`, `desert`, `marsh`, `urban` (vedi `TERRAIN` in `data.js`) |
| `nb` | int[] | province adiacenti (terra, mare e stretti) |
| `cx`, `cy` | float | punto interno della provincia (segnalini, frecce, etichette), unità mappa |
| `x`, `y` | float | uguali a `cx`, `cy` (compatibilità) |
| `coastal` | bool | provincia terrestre che tocca il mare |
| `nearLand` | bool | provincia marittima che tocca la terra |
| `state` | int | indice in `MAP.states` (-1 in mare) |
| `region` | int | indice in `MAP.regions` (regione strategica) |
| `area` | int | km² |
| `vp` | int | punti vittoria (capitali delle grandi potenze 30, altre capitali 15, città 1-15) |
| `city` | string\|null | nome della città principale (nomi italiani o del 1936: Danzica, Breslavia, Leningrado...) |
| `port` | int | base navale 0-10 (Kiel, Portsmouth, Tolone, La Spezia 10; porti minori 1-2) |
| `rail` | int | livello della ferrovia migliore che passa nella provincia, 0-5 |
| `hub` | bool | hub di rifornimento (capoluogo di stato collegato alla ferrovia, oppure capitale) |
| `infra` | int | infrastrutture dello stato, 1-5 |
| `elev` | int | quota media in metri |
| `lon`, `lat` | float | longitudine e latitudine del centro (gradi) |

### Oggetto `MAP`

- `MAP.states[s]` → `{ name, owner, provinces[], capital, manpower, infra, category, slots, industry, resources, area, region }`
  - `owner`: proprietario nel 1936 (statico; durante la partita vale `S.tiles[i].owner`)
  - `capital`: provincia capoluogo (città più importante)
  - `manpower`: popolazione stimata 1936 (popolazione nazionale distribuita per urbanizzazione e città)
  - `category`/`slots`: categoria HOI4 (`pastorale` 1, `rurale` 2, `cittadina` 4, `grande cittadina` 5, `città` 6, `grande città` 8, `metropoli` 10, `megalopoli` 12, `deserto` 0) e slot edifici
  - `industry`: peso industriale (km² urbanizzati × sviluppo del paese), utile per distribuire le fabbriche
  - `resources`: es. `{ oil: 22 }`, `{ steel: 32 }`; risorse `oil`, `steel`, `aluminium`, `rubber`, `tungsten`, `chromium` con valori in stile HOI4 (Ploiești, Baku, Kiruna, Lorena, Krivoj Rog, Texas e California, Venezuela, Indie olandesi, gomma della Malesia e di Sumatra, tungsteno cinese, cromo turco e sudafricano...)
- `MAP.regions[r]` → `{ name, sea, states[] }` per le terrestri, `{ name, sea: true, provinces[] }` per le marittime (Mare del Nord, Mar Tirreno, Mediterraneo centrale...). Servono per meteo, guerra aerea e navale
- `mapEdge(a, b)` → `{ len, river, strait, rail }` per due province adiacenti: lunghezza del confine in km, se c'è un fiume da attraversare (penalità di attraversamento), se è uno stretto (Dardanelli, Messina, Øresund, Kerč, Gibilterra, Bonifacio...), livello della ferrovia 0-5 tra le due
- `provDistKm(a, b)` → distanza in km tra i centri (sul globo, con lon/lat: vale anche attraverso la giunzione)
- `MAP.data` = `MAP_DATA` grezzo

### `MAP_DATA` (formato del file)

```
{
  version: 2, year: 1936, name: 'Mondo 1936', projection, wrapX: true, kmPerUnit: 4,
  width, height, quant, reliefScale,       // relief.png è a metà risoluzione (reliefScale 2)
  countries: { G: { name, capital }, ... },
  states: [...], regions: [...],
  provinces: [{ id, type: 'land'|'sea', x, y, lon, lat, area, terrain, region, state?, coastal?, vp?, city?, port?, rail?, hub?, elev?, rings }],
  adjacency: [[a, b, lunghezzaKm, flag]],   // flag 0 normale, 1 fiume, 2 stretto
  straits: [[a, b, nome]],
  railways: [[a, b, livello]],              // tratte ferroviarie tra province adiacenti
  rivers: [{ w: 1-3, name, pts: [x0, y0, x1, y1, ...] }],
  arcs: [[x0, y0, dx1, dy1, ...]],          // confini come archi condivisi (interi, × quant), delta
  arcSides: [a0, b0, a1, b1, ...],          // province ai due lati di ogni arco (-1 = lago o bordo)
  sources: [...]
}
```

`rings` di una provincia è una lista di anelli; ogni anello è una lista di indici di archi
(`~k` = arco `k` percorso al contrario), come in TopoJSON. Lo stesso arco è condiviso dalle due
province ai suoi lati, quindi i confini combaciano sempre e si possono disegnare per categoria
(confine di stato, di paese, linea del fronte, costa) guardando `arcSides`.

## Disegno (render.js)

- `Render.mapMode` / `Render.setMapMode(m)`: `political`, `terrain`, `state`, `region`, `infra`,
  `railway`, `resources`. `Render.MAP_MODES` ha le coppie `[id, nome italiano]` per la barra delle modalità.
- `Render.modeColors[id] = t => colore`: aggiunge una modalità nuova (es. `supply`) colorando le province.
- `Render.overlays.push((ctx, view) => { ... })`: disegno aggiuntivo (rifornimenti, meteo, frecce)
  dopo la mappa e prima dei segnalini; `ctx` è già in coordinate mappa, `view.lw` è lo spessore di
  un pixel schermo in unità mappa.
- `Render.tileAt(x, y)` restituisce la provincia sotto il punto dello schermo; `Render.paths[i]`
  è il `Path2D` della provincia.
- Il livello della mappa è in cache: si ridisegna quando cambia la vista o quando `S.mapDirty = true`
  (cambio di controllo, guerre). Da lontano usa un'immagine dell'intera mappa.
- I segnalini delle divisioni hanno dimensione fissa sullo schermo e usano `divMaxOrg(d)` se esiste.
- Con `wrapX` la mappa si ripete in orizzontale: `Render.copies(view, larghezza)` dà gli spostamenti
  delle copie visibili e gli overlay vengono chiamati una volta per copia. Confini, fiumi e
  ferrovie sono divisi in blocchi spaziali (`ChunkedPath`), quindi in zoom si disegna solo il visibile.

## Come sono stati costruiti i dati

1. **Confini 1936**: fuori dall'Europa le colonie vanno ai loro proprietari (Impero britannico,
   Francia, Paesi Bassi, Belgio, Portogallo, Italia, Spagna, Giappone con Corea, Taiwan,
   Karafuto e mandato del Pacifico), i dominion hanno il loro tag (CAN, AST, NZL, SAF, RAJ con
   Birmania, Pakistan e Bangladesh); la Cina è divisa come in HOI4 tra Nanchino (CHI), comunisti
   dello Shaanxi (PRC), Manciukuò (MAN), Mengjiang (MEN), Shanxi (SHX), Guangxi (GXC), Yunnan
   (YUN), Xibei San Ma (XSM), Sinkiang (SIK) e Tibet (TIB); Tannu Tuva (TAN) e Mongolia (MON)
   sono indipendenti. Le regole sono in `tables.py` (`DIRECT_ADM0`, `CHN_PROVINCES`,
   `POLY_OVERRIDE_ADM0`). In Europa, per i paesi con confini uguali a oggi (Francia, Spagna, Regno Unito,
   Austria, Cecoslovacchia, Ungheria, Turchia...) si usano le regioni amministrative di Natural Earth;
   per gli altri (Germania, Polonia, URSS, Baltici, Romania, Finlandia, Italia, Jugoslavia...) i
   confini storici di historical-basemaps (1938), riportati al 1936: Austria e Cecoslovacchia intere,
   Rutenia subcarpatica cecoslovacca, Dobrugia meridionale romena, Memel lituana, Danzica alla
   Germania (era una città libera con governo nazista), Marocco spagnolo, Zara italiana.
2. **Stati**: regioni amministrative accorpate (le piccole) o divise (le grandi) fino a una
   dimensione obiettivo che dipende dalla zona (`density_class` in `tables.py`: 15.000 km² in
   Giappone, 17.000 in Europa occidentale, 55.000 in URSS europea, 280.000 in Siberia e Artico),
   con i nomi in italiano e quelli tedeschi del 1936 a est.
3. **Province**: ogni stato è diviso in province (2.600 km² in Europa occidentale fino a 45.000
   nell'Artico) con un Voronoi a bordi irregolari; i mari sono divisi per regione marina e gli
   oceani in celle di 30°×20° ("Oceano Pacifico (10°N 150°W)").
4. **Terreno**: pendenza e quota (Terrain Tiles AWS) + copertura del suolo (ESA WorldCover):
   montagna, colline, foresta, palude, deserto, urbano, pianura. Le soglie di pendenza sono
   relative (percentili 76 e 93 delle province), perché il rilievo mondiale è a bassa risoluzione.
5. **Ferrovie**: tracciati di Natural Earth (rete attuale, molto vicina a quella del 1936 in
   Europa) tradotti in tratte tra province adiacenti, livello 1-5 secondo numero di linee,
   sviluppo del paese e grandi città.
6. **Città e punti vittoria** da Natural Earth, **porti** da Natural Earth + elenco delle basi navali
   del 1936, **fiumi** principali per la penalità di attraversamento.

Fonti: historical-basemaps (A. Ourednik, GPL-3.0), Natural Earth (pubblico dominio),
Mapzen/AWS Terrain Tiles, ESA WorldCover 2021 (CC-BY 4.0).
