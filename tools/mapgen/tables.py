"""Tabelle storiche (1936) usate dal generatore della mappa.

I codici dei paesi sono quelli del gioco (game/js/data.js, COUNTRY_DEFS): le nazioni gia'
presenti mantengono la loro lettera, quelle nuove usano il tag di Hearts of Iron IV.
"""

# Nome nel file world_1938.geojson (historical-basemaps) -> codice del gioco
HIST_NAME = {
    'Germany': 'G', 'France': 'F', 'United Kingdom': 'U', 'Italy': 'I', 'USSR': 'S',
    'Armenia': 'S', 'Azerbaijan': 'S', 'Georgia': 'S', 'Poland': 'P', 'Spain': 'E',
    'Portugal': 'O', 'Belgium': 'B', 'Netherlands': 'HOL', 'Luxembourg': 'LUX', 'Denmark': 'D',
    'Norway': 'N', 'Sweden': 'W', 'Finland': 'K', 'Estonia': 'EST', 'Latvia': 'LAT',
    'Lithuania': 'LIT', 'Czechoslovakia': 'C', 'Switzerland': 'Z', 'Hungary': 'H',
    'Romania': 'R', 'Yugoslavia': 'Y', 'Bulgaria': 'L', 'Greece': 'Q', 'Turkey': 'T',
    'Albania': 'ALB', 'Ireland': 'IRE', 'Iceland': 'ICE', 'Egypt': 'EGY', 'Iran': 'PER',
    'Saudi Arabia': 'SAU', 'Hejaz': 'SAU', 'Libya': 'I', 'Algeria (France)': 'F',
    'Morocco (France)': 'F', 'Tunisia': 'F', 'Syria (France)': 'F', 'Mandatory Palestine (GB)': 'U',
    'Israel': 'U', 'Jordan': 'U', 'Mesopotamia (GB)': 'IRQ', 'Andorra': 'E',
    'Afghanistan': 'PER',
}

# Paesi moderni i cui confini coincidono con quelli del 1936: si usano le regioni
# amministrative di Natural Earth, molto piu' precise dei confini storici.
DIRECT_ADM0 = {
    'FRA': 'F', 'BEL': 'B', 'NLD': 'HOL', 'LUX': 'LUX', 'CHE': 'Z', 'LIE': 'Z', 'ESP': 'E',
    'AND': 'E', 'PRT': 'O', 'GBR': 'U', 'IMN': 'U', 'JEY': 'U', 'GGY': 'U', 'GIB': 'U',
    'NOR': 'N', 'SWE': 'W', 'DNK': 'D', 'ISL': 'ICE', 'IRL': 'IRE', 'AUT': 'A', 'CZE': 'C',
    'SVK': 'C', 'HUN': 'H', 'TUR': 'T', 'ARM': 'S', 'AZE': 'S', 'GEO': 'S', 'KAZ': 'S',
    'TKM': 'S', 'UZB': 'S', 'ALB': 'ALB', 'EGY': 'EGY', 'LBY': 'I', 'DZA': 'F', 'TUN': 'F',
    'MAR': 'F', 'SAH': 'F', 'MRT': 'F', 'LBN': 'F', 'SYR': 'F', 'JOR': 'U', 'ISR': 'U',
    'PSX': 'U', 'KWT': 'U', 'CYP': 'U', 'CYN': 'U', 'ESB': 'U', 'WSB': 'U', 'MLT': 'U',
    'IRQ': 'IRQ', 'IRN': 'PER', 'SAU': 'SAU', 'AFG': 'PER', 'PAK': 'PER', 'MCO': 'F',
    'SMR': 'I', 'VAT': 'I', 'ALD': 'K', 'GRL': 'D', 'FRO': 'D',
}

# Eccezioni per singola regione amministrativa (adm1_code -> codice)
ADM1_OVERRIDE = {
    'UKR-293': 'C',  # Rutenia subcarpatica: cecoslovacca fino al 1938
    'BGR-2261': 'R',  # Dobrugia meridionale (Silistra): romena fino al 1940
    'BGR-2259': 'R',  # Dobrugia meridionale (Dobrich)
}

# Correzioni puntuali con poligoni in lon/lat (applicate per ultime)
POLY_OVERRIDE = [
    # Protettorato spagnolo del Marocco settentrionale
    ('E', [(-6.35, 34.95), (-6.25, 35.55), (-5.92, 35.80), (-5.40, 35.93), (-4.50, 35.30),
           (-3.90, 35.25), (-2.95, 35.45), (-2.85, 35.05), (-3.70, 34.80), (-5.00, 34.75),
           (-5.90, 34.80)]),
    # Zara (Zadar), enclave italiana in Dalmazia
    ('I', [(15.18, 44.08), (15.30, 44.08), (15.30, 44.17), (15.18, 44.17)]),
    # Citta' libera di Danzica: governo nazista, la assegniamo alla Germania
    ('G', [(18.45, 54.20), (19.05, 54.20), (19.30, 54.45), (18.95, 54.45), (18.55, 54.60), (18.45, 54.45)]),
]

# Nazioni del gioco (codice -> nome italiano, capitale [lon, lat], classe di densita')
# classe: W = Europa occidentale/centrale, E = Europa orientale/mediterranea,
#         S = URSS, D = deserti, colonie e Medio Oriente
COUNTRIES = {
    'G': ('Germania', (13.40, 52.52), 'W'), 'F': ('Francia', (2.35, 48.86), 'W'),
    'U': ('Regno Unito', (-0.13, 51.51), 'W'), 'I': ('Italia', (12.50, 41.90), 'W'),
    'S': ('Unione Sovietica', (37.62, 55.75), 'S'), 'P': ('Polonia', (21.01, 52.23), 'E'),
    'E': ('Spagna', (-3.70, 40.42), 'E'), 'O': ('Portogallo', (-9.14, 38.72), 'E'),
    'B': ('Belgio', (4.35, 50.85), 'W'), 'HOL': ('Paesi Bassi', (4.90, 52.37), 'W'),
    'LUX': ('Lussemburgo', (6.13, 49.61), 'W'), 'D': ('Danimarca', (12.57, 55.68), 'W'),
    'N': ('Norvegia', (10.75, 59.91), 'E'), 'W': ('Svezia', (18.07, 59.33), 'E'),
    'K': ('Finlandia', (24.94, 60.17), 'E'), 'EST': ('Estonia', (24.75, 59.44), 'E'),
    'LAT': ('Lettonia', (24.11, 56.95), 'E'), 'LIT': ('Lituania', (23.90, 54.90), 'E'),
    'C': ('Cecoslovacchia', (14.42, 50.09), 'W'), 'A': ('Austria', (16.37, 48.21), 'W'),
    'Z': ('Svizzera', (7.45, 46.95), 'W'), 'H': ('Ungheria', (19.04, 47.50), 'E'),
    'R': ('Romania', (26.10, 44.43), 'E'), 'Y': ('Jugoslavia', (20.46, 44.82), 'E'),
    'L': ('Bulgaria', (23.32, 42.70), 'E'), 'Q': ('Grecia', (23.73, 37.98), 'E'),
    'T': ('Turchia', (32.86, 39.93), 'E'), 'ALB': ('Albania', (19.82, 41.33), 'E'),
    'IRE': ('Irlanda', (-6.26, 53.35), 'W'), 'ICE': ('Islanda', (-21.94, 64.15), 'D'),
    'EGY': ('Egitto', (31.24, 30.04), 'D'), 'IRQ': ('Iraq', (44.37, 33.31), 'D'),
    'PER': ('Persia', (51.39, 35.69), 'D'), 'SAU': ('Arabia Saudita', (46.72, 24.69), 'D'),
}
# Ordine di priorita' per le regioni miste: le colonie e i territori desertici usano la classe D
COLONY_ADM0 = {'LBY', 'DZA', 'TUN', 'MAR', 'SAH', 'MRT', 'LBN', 'SYR', 'JOR', 'ISR', 'PSX', 'KWT',
               'KAZ', 'TKM', 'UZB'}

# Area obiettivo (km2) di stati e province per classe di densita'
STATE_KM2 = {'W': 17000, 'E': 30000, 'S': 55000, 'D': 110000}
PROV_KM2 = {'W': 2600, 'E': 4200, 'S': 7500, 'D': 16000}

# Popolazione 1936 (milioni, solo territorio metropolitano nell'area della mappa) e
# livello di sviluppo (0-1) usato per infrastrutture e peso industriale
POP_1936 = {
    'G': 67.0, 'F': 41.9, 'U': 47.1, 'I': 42.9, 'S': 120.0, 'P': 34.0, 'E': 25.0, 'O': 7.3,
    'B': 8.3, 'HOL': 8.5, 'LUX': 0.3, 'D': 3.7, 'N': 2.9, 'W': 6.3, 'K': 3.8, 'EST': 1.1,
    'LAT': 1.95, 'LIT': 2.5, 'C': 15.0, 'A': 6.8, 'Z': 4.2, 'H': 9.0, 'R': 19.0, 'Y': 15.0,
    'L': 6.2, 'Q': 7.0, 'T': 16.2, 'ALB': 1.0, 'IRE': 3.0, 'ICE': 0.12, 'EGY': 15.9,
    'IRQ': 3.6, 'PER': 14.0, 'SAU': 2.5,
}
# Popolazione delle colonie (milioni), assegnata ai loro stati
POP_COLONY = {'DZA': 7.2, 'TUN': 2.6, 'MAR': 6.3, 'LBY': 0.85, 'SYR': 2.8, 'LBN': 0.85,
              'JOR': 0.3, 'ISR': 1.3, 'PSX': 0.0, 'KWT': 0.07, 'CYP': 0.37, 'MLT': 0.25}
DEV = {
    'G': 1.0, 'U': 1.0, 'B': 0.95, 'HOL': 0.95, 'LUX': 0.9, 'F': 0.85, 'Z': 0.85, 'D': 0.8,
    'C': 0.75, 'A': 0.7, 'W': 0.7, 'I': 0.6, 'N': 0.55, 'K': 0.5, 'H': 0.5, 'IRE': 0.5,
    'P': 0.42, 'EST': 0.45, 'LAT': 0.45, 'LIT': 0.35, 'S': 0.4, 'E': 0.4, 'O': 0.35,
    'R': 0.32, 'Y': 0.3, 'L': 0.3, 'Q': 0.3, 'T': 0.22, 'ALB': 0.12, 'ICE': 0.3, 'EGY': 0.25,
    'IRQ': 0.15, 'PER': 0.15, 'SAU': 0.05,
}

# Basi navali principali del 1936 (lon, lat, livello 1-10)
NAVAL_BASES = [
    (10.14, 54.32, 10, 'Kiel'), (8.13, 53.52, 8, 'Wilhelmshaven'), (-1.09, 50.80, 10, 'Portsmouth'),
    (-4.14, 50.37, 8, 'Plymouth'), (-3.00, 58.90, 6, 'Scapa Flow'), (-3.40, 56.03, 6, 'Rosyth'),
    (5.93, 43.12, 10, 'Tolone'), (-4.49, 48.39, 8, 'Brest'), (-1.62, 49.64, 4, 'Cherbourg'),
    (9.83, 44.10, 10, 'La Spezia'), (17.23, 40.47, 8, 'Taranto'), (14.27, 40.84, 4, 'Napoli'),
    (13.76, 45.65, 4, 'Trieste'), (33.52, 44.62, 8, 'Sebastopoli'), (29.77, 59.99, 8, 'Kronštadt'),
    (33.08, 69.07, 2, 'Murmansk'), (40.55, 64.55, 2, 'Arcangelo'), (-8.23, 43.48, 6, 'Ferrol'),
    (-6.29, 36.53, 4, 'Cadice'), (-0.98, 37.60, 6, 'Cartagena'), (-9.13, 38.70, 4, 'Lisbona'),
    (-5.35, 36.14, 6, 'Gibilterra'), (14.51, 35.89, 8, 'Malta'), (29.89, 31.20, 6, 'Alessandria'),
    (23.57, 37.94, 4, 'Salamina'), (28.98, 41.03, 4, 'Istanbul'), (12.60, 55.69, 4, 'Copenaghen'),
    (18.10, 59.32, 4, 'Stoccolma'), (15.59, 56.16, 4, 'Karlskrona'), (10.72, 59.90, 3, 'Oslo'),
    (5.32, 60.39, 3, 'Bergen'), (22.30, 60.45, 3, 'Turku'), (18.53, 54.53, 4, 'Gdynia'),
    (4.13, 51.98, 4, 'Rotterdam'), (4.77, 52.96, 4, 'Den Helder'), (3.20, 51.33, 2, 'Zeebrugge'),
    (16.44, 43.51, 4, 'Spalato'), (18.55, 42.45, 4, 'Cattaro'), (28.65, 44.17, 4, 'Costanza'),
    (27.92, 43.20, 3, 'Varna'), (12.33, 45.44, 4, 'Venezia'), (15.08, 37.50, 3, 'Catania'),
    (9.13, 39.21, 3, 'Cagliari'), (8.79, 42.56, 2, 'Calvi'), (10.30, 36.80, 4, 'Biserta'),
    (-0.64, 35.71, 4, 'Mers-el-Kebir'), (13.19, 32.89, 4, 'Tripoli'), (20.07, 32.12, 3, 'Bengasi'),
    (23.96, 32.08, 3, 'Tobruch'), (28.22, 36.44, 4, 'Rodi'), (34.99, 32.82, 4, 'Haifa'),
    (32.30, 31.26, 4, 'Porto Said'), (30.73, 46.48, 4, 'Odessa'),
    (24.10, 57.00, 3, 'Riga'), (21.00, 56.50, 3, 'Libau'), (24.75, 59.45, 3, 'Tallinn'),
    (-6.20, 53.35, 2, 'Dublino'), (-21.94, 64.15, 1, 'Reykjavík'), (-5.93, 54.60, 3, 'Belfast'),
]

# Stretti attraversabili via terra (attacco anfibio non necessario): coppie lon/lat
STRAITS = [
    ((28.97, 41.02), (29.03, 41.03), 'Bosforo'), ((26.40, 40.20), (26.38, 40.10), 'Dardanelli'),
    ((15.62, 38.22), (15.60, 38.10), 'Stretto di Messina'), ((12.60, 55.70), (12.95, 55.60), 'Øresund'),
    ((10.90, 55.30), (11.10, 55.35), 'Grande Belt'), ((9.75, 55.50), (9.80, 55.45), 'Piccolo Belt'),
    ((36.48, 45.35), (36.60, 45.25), 'Stretto di Kerč'), ((-5.60, 36.00), (-5.60, 35.80), 'Gibilterra'),
    ((9.20, 41.35), (9.25, 41.25), 'Bocche di Bonifacio'),
    ((24.00, 37.95), (23.97, 38.05), 'Euripo'), ((11.60, 54.65), (11.25, 54.45), 'Fehmarn Belt'),
    ((23.40, 59.00), (22.90, 58.95), 'Moonsund'),
    ((-3.0, 58.75), (-3.05, 58.65), 'Pentland Firth'),
]

# Linee da scavare nel mare perche' gli stretti stretti restino navigabili a 2 km/pixel
SEA_CHANNELS = [
    [(29.13, 41.25), (29.07, 41.12), (29.02, 41.04), (28.99, 40.99)],  # Bosforo
    [(26.15, 40.03), (26.35, 40.15), (26.55, 40.32), (26.68, 40.42)],  # Dardanelli
    [(36.58, 45.45), (36.60, 45.30), (36.55, 45.15)],                  # Kerč
    [(15.64, 38.27), (15.60, 38.15), (15.55, 38.02)],                  # Messina
    [(12.62, 56.05), (12.72, 55.80), (12.80, 55.50)],                  # Øresund
]

# Giacimenti strategici 1936 (lon, lat, risorsa, quantita' stile HOI4)
# risorse: oil (petrolio), steel (acciaio/ferro), aluminium (alluminio/bauxite),
#          rubber (gomma), tungsten (tungsteno), chromium (cromo)
RESOURCES = [
    (49.87, 40.40, 'oil', 40), (45.70, 43.32, 'oil', 12), (40.10, 44.60, 'oil', 6),  # Baku, Grozny, Majkop
    (26.02, 44.94, 'oil', 22), (25.0, 45.0, 'oil', 6),                                # Ploiești
    (44.40, 35.47, 'oil', 12), (43.14, 36.34, 'oil', 6),                              # Kirkuk, Mosul
    (48.30, 30.35, 'oil', 6), (49.30, 31.30, 'oil', 10),                              # Abadan, Masjed Soleyman
    (22.55, 49.42, 'oil', 3), (16.80, 48.60, 'oil', 2), (19.6, 40.70, 'oil', 2),      # Galizia, Zistersdorf, Albania
    (9.8, 52.6, 'oil', 2), (32.5, 29.4, 'oil', 2), (56.0, 53.5, 'oil', 3),           # Hannover, Suez, Bashkiria
    (20.20, 67.85, 'steel', 32), (20.65, 67.17, 'steel', 12), (15.0, 60.2, 'steel', 8),  # Kiruna, Gällivare, Bergslagen
    (6.00, 49.20, 'steel', 28), (5.8, 49.5, 'steel', 6),                              # Lorena
    (33.35, 47.90, 'steel', 22), (37.8, 48.0, 'steel', 12),                           # Kryvyi Rih, Donbass
    (37.5, 51.3, 'steel', 6), (59.0, 53.4, 'steel', 16),                              # Kursk, Magnitogorsk
    (7.0, 51.45, 'steel', 18), (18.9, 50.3, 'steel', 8), (10.1, 52.15, 'steel', 6),   # Ruhr, Slesia, Salzgitter
    (-2.93, 43.26, 'steel', 12), (-1.2, 54.5, 'steel', 12), (-3.2, 51.6, 'steel', 6),  # Bilbao, Cleveland, Galles
    (14.9, 47.5, 'steel', 6), (18.0, 48.8, 'steel', 4), (13.4, 50.3, 'steel', 4),     # Erzberg, Slovacchia, Boemia
    (22.0, 46.0, 'steel', 4), (16.5, 44.8, 'steel', 6), (20.6, 48.1, 'steel', 4),     # Hunedoara, Ljubija, Miskolc
    (-1.4, 37.5, 'steel', 4), (23.0, 64.0, 'steel', 2), (8.5, 39.4, 'steel', 2),      # Murcia, Finlandia, Sardegna
    (10.4, 42.8, 'steel', 4), (-8.0, 35.0, 'steel', 2), (36.0, 51.7, 'steel', 4),     # Elba, Algeria, Kursk
    (6.2, 43.4, 'aluminium', 12), (3.4, 43.6, 'aluminium', 6),                        # Var, Hérault
    (17.9, 47.1, 'aluminium', 14), (17.0, 43.5, 'aluminium', 10), (15.5, 45.0, 'aluminium', 6),  # Bakony, Dalmazia
    (22.9, 38.5, 'aluminium', 8), (14.1, 45.1, 'aluminium', 4), (33.0, 59.5, 'aluminium', 4),    # Grecia, Istria, Tichvin
    (13.6, 41.8, 'aluminium', 3), (8.0, 50.7, 'aluminium', 2), (14.0, 63.0, 'aluminium', 2),
    (-7.0, 39.8, 'tungsten', 16), (-8.0, 40.7, 'tungsten', 8), (-6.5, 42.4, 'tungsten', 10),  # Panasqueira, Galizia
    (-3.5, 50.5, 'tungsten', 2), (12.9, 50.4, 'tungsten', 4), (11.5, 47.2, 'tungsten', 2),
    (42.0, 43.3, 'tungsten', 6), (16.0, 63.5, 'tungsten', 2),
    (29.0, 37.6, 'chromium', 14), (36.5, 38.4, 'chromium', 10), (39.5, 38.7, 'chromium', 8),  # Turchia
    (20.4, 41.9, 'chromium', 10), (21.4, 42.1, 'chromium', 8), (22.2, 40.3, 'chromium', 6),   # Albania, Macedonia, Grecia
    (58.5, 50.5, 'chromium', 12), (20.6, 64.0, 'chromium', 2), (11.5, 63.9, 'chromium', 2),
]

CAPITAL_CITY = {  # nome della citta' capitale per i punti vittoria
    'LIT': 'Kaunas', 'HOL': 'Amsterdam', 'SAU': 'Riad',
}

# Nomi italiani delle regioni marine (Natural Earth name -> nome)
SEA_NAMES = {
    'North Atlantic Ocean': 'Oceano Atlantico', 'Black Sea': 'Mar Nero', 'Norwegian Sea': 'Mare di Norvegia',
    'Greenland Sea': 'Mare di Groenlandia', 'Bay of Biscay': 'Golfo di Biscaglia', 'Baltic Sea': 'Mar Baltico',
    'Barents Sea': 'Mare di Barents', 'North Sea': 'Mare del Nord', 'Bristol Channel': 'Canale di Bristol',
    'Inner Seas': 'Ebridi', 'Irish Sea': 'Mare d\'Irlanda', 'Kara Sea': 'Mare di Kara',
    'Tyrrhenian Sea': 'Mar Tirreno', 'White Sea': 'Mar Bianco', 'Sea of Azov': 'Mare d\'Azov',
    'Gulf of Finland': 'Golfo di Finlandia', 'English Channel': 'Canale della Manica',
    'Golfe du Lion': 'Golfo del Leone', 'Gulf of Bothnia': 'Golfo di Botnia', 'Adriatic Sea': 'Mare Adriatico',
    'Ionian Sea': 'Mar Ionio', 'Balearic Sea': 'Mare delle Baleari', 'Aegean Sea': 'Mar Egeo',
    'Skagerrak': 'Skagerrak', 'Kattegat': 'Kattegat', 'Gulf of Riga': 'Golfo di Riga',
    'Gulf of Sidra': 'Golfo della Sirte', 'Sea of Crete': 'Mare di Creta', 'Ligurian Sea': 'Mar Ligure',
    'Alboran Sea': 'Mare di Alboran', 'Sea of Marmara': 'Mar di Marmara', 'Gulf of Gabès': 'Golfo di Gabès',
    'Persian Gulf': 'Golfo Persico', 'Red Sea': 'Mar Rosso', 'Gulf of Suez': 'Golfo di Suez',
    'Denmark Strait': 'Stretto di Danimarca', 'Vestfjorden': 'Mare di Norvegia',
}
# Regioni marine abbastanza piccole da avere province piu' fitte
SEA_ENCLOSED = {'Mar Nero', 'Mar Baltico', 'Mare del Nord', 'Canale della Manica', 'Mar Tirreno',
                'Mare Adriatico', 'Mar Ionio', 'Mar Egeo', 'Mare delle Baleari', 'Mar Ligure',
                'Golfo di Finlandia', 'Golfo di Botnia', 'Golfo di Riga', 'Kattegat', 'Skagerrak',
                'Mare d\'Irlanda', 'Mare d\'Azov', 'Mar di Marmara', 'Mare di Creta', 'Golfo del Leone',
                'Mare di Alboran', 'Golfo di Gabès', 'Golfo della Sirte', 'Canale di Bristol', 'Ebridi',
                'Mar Bianco', 'Mediterraneo occidentale', 'Mediterraneo centrale', 'Mediterraneo orientale',
                'Golfo Persico', 'Mar Rosso', 'Golfo di Suez', 'Mar Caspio'}

# Nomi 1936 per gli stati tedeschi oggi in Polonia/Russia (nome NE in italiano -> nome)
GERMAN_EAST = {
    'voivodato della Bassa Slesia': 'Bassa Slesia', 'voivodato di Opole': 'Alta Slesia',
    'voivodato di Lubusz': 'Neumark', 'voivodato della Pomerania Occidentale': 'Pomerania',
    'voivodato della Pomerania': 'Pomerania orientale', 'Kaliningrad': 'Prussia Orientale',
    "Oblast' di Kaliningrad": 'Prussia Orientale', 'voivodato della Grande Polonia': 'Grenzmark',
    'voivodato della Varmia-Masuria': 'Masuria', 'voivodato della Slesia': 'Alta Slesia',
    'Kaliningradskaya': 'Prussia Orientale',
}
FINNISH_EAST = {'Repubblica di Carelia': 'Carelia orientale', 'Leningrado': 'Istmo di Carelia',
                "Oblast' di Leningrado": 'Istmo di Carelia', 'Murmansk': 'Petsamo',
                "Oblast' di Murmansk": 'Petsamo'}
