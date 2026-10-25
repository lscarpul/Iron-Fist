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

# ======================================================================================
# Mondo intero (aggiunto quando la mappa e' stata estesa al pianeta)
# ======================================================================================
WORLD_COUNTRIES = {
    'USA': ('Stati Uniti', (-77.04, 38.90)), 'JAP': ('Giappone', (139.69, 35.69)),
    'CHI': ('Cina', (118.80, 32.06)), 'PRC': ('Cina comunista', (109.49, 36.59)),
    'MAN': ('Manciukuò', (125.32, 43.82)), 'MEN': ('Mengjiang', (114.88, 40.77)),
    'SHX': ('Shanxi', (112.55, 37.87)), 'GXC': ('Guangxi', (110.30, 25.27)),
    'YUN': ('Yunnan', (102.71, 25.04)), 'XSM': ('Xibei San Ma', (103.83, 36.06)),
    'SIK': ('Sinkiang', (87.62, 43.83)), 'TIB': ('Tibet', (91.11, 29.65)),
    'MON': ('Mongolia', (106.91, 47.89)), 'TAN': ('Tannu Tuva', (94.45, 51.72)),
    'RAJ': ('Raj britannico', (77.21, 28.61)), 'NEP': ('Nepal', (85.32, 27.71)),
    'BHU': ('Bhutan', (89.64, 27.47)), 'AFG': ('Afghanistan', (69.17, 34.53)),
    'SIA': ('Siam', (100.50, 13.76)), 'PHI': ('Filippine', (120.98, 14.60)),
    'CAN': ('Canada', (-75.70, 45.42)), 'AST': ('Australia', (149.13, -35.28)),
    'NZL': ('Nuova Zelanda', (174.78, -41.29)), 'SAF': ('Sudafrica', (28.19, -25.75)),
    'MEX': ('Messico', (-99.13, 19.43)), 'GUA': ('Guatemala', (-90.51, 14.64)),
    'HON': ('Honduras', (-87.21, 14.07)), 'ELS': ('El Salvador', (-89.19, 13.69)),
    'NIC': ('Nicaragua', (-86.25, 12.13)), 'COS': ('Costa Rica', (-84.09, 9.93)),
    'PAN': ('Panama', (-79.52, 8.98)), 'CUB': ('Cuba', (-82.37, 23.11)),
    'HAI': ('Haiti', (-72.34, 18.54)), 'DOM': ('Repubblica Dominicana', (-69.93, 18.47)),
    'COL': ('Colombia', (-74.07, 4.71)), 'VEN': ('Venezuela', (-66.90, 10.48)),
    'ECU': ('Ecuador', (-78.47, -0.18)), 'PRU': ('Perù', (-77.04, -12.05)),
    'BOL': ('Bolivia', (-68.15, -16.50)), 'CHL': ('Cile', (-70.65, -33.45)),
    'ARG': ('Argentina', (-58.38, -34.60)), 'PAR': ('Paraguay', (-57.58, -25.26)),
    'URU': ('Uruguay', (-56.16, -34.90)), 'BRA': ('Brasile', (-43.21, -22.91)),
    'ETH': ('Etiopia', (38.75, 9.03)), 'LIB': ('Liberia', (-10.80, 6.30)),
    'YEM': ('Yemen', (44.21, 15.35)), 'OMA': ('Oman', (58.59, 23.61)),
}
for _k, (_n, _c) in WORLD_COUNTRIES.items():
    COUNTRIES[_k] = (_n, _c, 'M')
CAPITAL_CITY.update({'CHI': 'Nanchino', 'PRC': "Yan'an", 'MAN': 'Hsinking', 'MEN': 'Kalgan',
                     'RAJ': 'Nuova Delhi', 'AST': 'Canberra', 'SAF': 'Pretoria', 'TAN': 'Kyzyl'})

DIRECT_ADM0.update({
    # Americhe
    'USA': 'USA', 'PRI': 'USA', 'VIR': 'USA', 'GUM': 'USA', 'ASM': 'USA', 'UMI': 'USA',
    'CAN': 'CAN', 'SPM': 'F', 'MEX': 'MEX', 'GTM': 'GUA', 'HND': 'HON', 'SLV': 'ELS', 'NIC': 'NIC',
    'CRI': 'COS', 'PAN': 'PAN', 'CUB': 'CUB', 'HTI': 'HAI', 'DOM': 'DOM', 'COL': 'COL', 'VEN': 'VEN',
    'ECU': 'ECU', 'PER': 'PRU', 'BOL': 'BOL', 'CHL': 'CHL', 'ARG': 'ARG', 'PRY': 'PAR', 'URY': 'URU',
    'BRA': 'BRA', 'GUY': 'U', 'SUR': 'HOL', 'BLZ': 'U', 'JAM': 'U', 'BHS': 'U', 'BRB': 'U',
    'TTO': 'U', 'GRD': 'U', 'LCA': 'U', 'VCT': 'U', 'DMA': 'U', 'ATG': 'U', 'KNA': 'U', 'MSR': 'U',
    'AIA': 'U', 'VGB': 'U', 'CYM': 'U', 'TCA': 'U', 'BMU': 'U', 'FLK': 'U', 'SGS': 'U',
    'ABW': 'HOL', 'CUW': 'HOL', 'SXM': 'HOL', 'BLM': 'F', 'MAF': 'F', 'CLP': 'F',
    # Africa
    'ETH': 'ETH', 'ERI': 'I', 'SOM': 'I', 'SOL': 'U', 'DJI': 'F', 'SDN': 'U', 'SDS': 'U',
    'KEN': 'U', 'UGA': 'U', 'TZA': 'U', 'RWA': 'B', 'BDI': 'B', 'COD': 'B', 'AGO': 'O', 'MOZ': 'O',
    'GNB': 'O', 'CPV': 'O', 'STP': 'O', 'ZAF': 'SAF', 'NAM': 'SAF', 'ZWE': 'U', 'ZMB': 'U',
    'MWI': 'U', 'BWA': 'U', 'LSO': 'U', 'SWZ': 'U', 'SEN': 'F', 'MLI': 'F', 'GIN': 'F', 'CIV': 'F',
    'BFA': 'F', 'NER': 'F', 'BEN': 'F', 'TCD': 'F', 'CAF': 'F', 'COG': 'F', 'GAB': 'F', 'CMR': 'F',
    'TGO': 'F', 'MDG': 'F', 'COM': 'F', 'NGA': 'U', 'GHA': 'U', 'SLE': 'U', 'GMB': 'U', 'LBR': 'LIB',
    'GNQ': 'E', 'MUS': 'U', 'SYC': 'U', 'SHN': 'U', 'IOT': 'U', 'ATF': 'F',
    # Asia
    'JPN': 'JAP', 'KOR': 'JAP', 'PRK': 'JAP', 'TWN': 'JAP', 'MNG': 'MON', 'IND': 'RAJ', 'BGD': 'RAJ',
    'PAK': 'RAJ', 'MMR': 'RAJ', 'LKA': 'U', 'MDV': 'U', 'NPL': 'NEP', 'BTN': 'BHU', 'AFG': 'AFG',
    'THA': 'SIA', 'VNM': 'F', 'LAO': 'F', 'KHM': 'F', 'MYS': 'U', 'SGP': 'U', 'BRN': 'U',
    'IDN': 'HOL', 'TLS': 'O', 'PHL': 'PHI', 'HKG': 'U', 'MAC': 'O', 'KGZ': 'S', 'TJK': 'S',
    'KAZ': 'S', 'TKM': 'S', 'UZB': 'S', 'YEM': 'YEM', 'OMN': 'OMA', 'ARE': 'U', 'QAT': 'U',
    'BHR': 'U', 'KAS': 'RAJ', 'KAB': 'AFG', 'PGA': 'CHI',
    # Oceania
    'AUS': 'AST', 'NFK': 'AST', 'PNG': 'AST', 'NZL': 'NZL', 'COK': 'NZL', 'NIU': 'NZL', 'WSM': 'NZL',
    'FJI': 'U', 'SLB': 'U', 'KIR': 'U', 'TUV': 'U', 'TON': 'U', 'NRU': 'AST', 'PCN': 'U',
    'VUT': 'F', 'NCL': 'F', 'PYF': 'F', 'WLF': 'F', 'PLW': 'JAP', 'FSM': 'JAP', 'MHL': 'JAP',
    'MNP': 'JAP', 'IOA': 'AST', 'HMD': 'AST', 'CSI': 'AST', 'ATC': 'AST', 'USG': 'USA', 'ATA': 'U',
    'GRL': 'D',
})
# l'Afghanistan torna un paese a se'
DIRECT_ADM0['AFG'] = 'AFG'
DIRECT_ADM0['PAK'] = 'RAJ'
HIST_NAME['Afghanistan'] = 'AFG'

# Cina 1936: governo nazionalista, signori della guerra, comunisti e stati fantoccio giapponesi
CHN_PROVINCES = {
    'Heilongjiang': 'MAN', 'Jilin': 'MAN', 'Liaoning': 'MAN', 'Inner Mongol': 'MEN',
    'Shanxi': 'SHX', 'Guangxi': 'GXC', 'Yunnan': 'YUN', 'Gansu': 'XSM', 'Qinghai': 'XSM',
    'Ningxia': 'XSM', 'Xinjiang': 'SIK', 'Xizang': 'TIB',
}
RUS_PROVINCES = {'Tuva': 'TAN'}

# Correzioni poligonali con filtro sul paese moderno: (codice, poligono, adm0 ammessi)
POLY_OVERRIDE_ADM0 = [
    ('MAN', [(116.5, 41.0), (127, 41.0), (127, 53.6), (116.5, 53.6)], {'CHN'}),   # Mongolia interna orientale e Rehe
    ('MAN', [(115.8, 40.4), (120.5, 40.4), (120.5, 42.6), (115.8, 42.6)], {'CHN'}),  # Rehe (Chengde)
    ('XSM', [(96, 37.0), (106.2, 37.0), (106.2, 43.0), (96, 43.0)], {'CHN'}),      # Alxa
    ('PRC', [(107.3, 35.9), (110.6, 35.9), (110.6, 38.2), (107.3, 38.2)], {'CHN'}),  # Shaanxi settentrionale (Yan'an)
    ('JAP', [(141.5, 45.9), (144.8, 45.9), (144.8, 50.0), (141.5, 50.0)], {'RUS'}),  # Karafuto
    ('JAP', [(145.3, 43.2), (157.0, 50.9), (156.0, 51.2), (145.0, 44.0)], {'RUS'}),  # Curili
    ('U', [(113.8, 22.15), (114.45, 22.15), (114.45, 22.56), (113.8, 22.56)], {'CHN', 'HKG'}),  # Hong Kong
    ('E', [(-10.2, 29.1), (-9.6, 29.1), (-9.6, 29.6), (-10.2, 29.6)], {'MAR'}),   # Ifni
    ('E', [(-13.2, 27.6), (-8.7, 27.6), (-8.7, 28.6), (-13.2, 28.6)], {'MAR'}),   # Capo Juby
    ('U', [(43.0, 12.3), (54.0, 12.3), (54.0, 19.0), (46.5, 19.0), (45.0, 13.6), (43.4, 13.0)], {'YEM'}),  # Aden
]


def density_class(code, adm0, lon, lat):
    """Classe di densita' delle province: piu' fitte dove HOI4 ha piu' province."""
    if -30 <= lon <= 60 and lat >= 27 and code in ('G', 'F', 'U', 'I', 'S', 'P', 'E', 'O', 'B', 'HOL',
            'LUX', 'D', 'N', 'W', 'K', 'EST', 'LAT', 'LIT', 'C', 'A', 'Z', 'H', 'R', 'Y', 'L', 'Q',
            'T', 'ALB', 'IRE', 'ICE', 'EGY', 'IRQ', 'PER', 'SAU'):
        if adm0 in COLONY_ADM0 or adm0 in ('EGY', 'IRQ', 'IRN', 'SAU', 'JOR', 'ISR', 'PSX', 'KWT'):
            return 'D'
        if adm0 == 'GRL':
            return 'X'
        return COUNTRIES[code][2]
    if code == 'S':
        return 'X' if lat > 54 or lon > 85 else 'L'
    if adm0 in ('JPN', 'KOR', 'PRK', 'TWN'):
        return 'J'
    if adm0 == 'CHN':
        if lon >= 103 and lat <= 41:
            return 'A'
        return 'M' if lon >= 118 else 'X'
    if adm0 in ('IND', 'BGD', 'LKA'):
        return 'A'
    if adm0 in ('PAK',):
        return 'M' if lon > 70 and lat > 29 else 'L'
    if adm0 in ('MMR', 'THA', 'VNM', 'LAO', 'KHM', 'MYS', 'SGP', 'IDN', 'PHL', 'BRN', 'TLS', 'NPL', 'BTN',
                'HKG', 'MAC'):
        return 'M'
    if adm0 == 'USA':
        if lat > 50 or lon < -165:
            return 'X'
        return 'M' if lon > -103 or lon < -150 else 'L'
    if adm0 == 'CAN':
        return 'M' if lat < 50 and lon > -100 else 'L' if lat < 56 else 'X'
    if adm0 in ('MEX', 'GTM', 'HND', 'SLV', 'NIC', 'CRI', 'PAN', 'CUB', 'HTI', 'DOM', 'JAM', 'PRI', 'NZL',
                'ZAF', 'TTO', 'BHS'):
        return 'M'
    if adm0 in ('BRA', 'COL', 'VEN', 'PER', 'BOL', 'ECU', 'GUY', 'SUR'):
        if lon < -52 and lat > -16 and adm0 != 'VEN' and lat < 4 and not (adm0 == 'COL' and lon > -76):
            return 'X'  # Amazzonia
        return 'L'
    if adm0 in ('ARG', 'CHL'):
        return 'L' if lat > -42 else 'X'
    if adm0 in ('PRY', 'URY'):
        return 'L'
    if adm0 == 'AUS':
        return 'L' if (lon > 141 and lat < -26) or (lon < 120 and lat < -30) else 'X'
    if adm0 in ('MNG', 'GRL', 'ATA'):
        return 'X'
    if lat > 60:
        return 'X'
    # Africa e Arabia
    if 15 <= lat <= 30 and -18 <= lon <= 60:
        return 'X'
    if lat < -17 and lon < 24 and adm0 in ('NAM', 'BWA', 'AGO'):
        return 'X'
    return 'L'


STATE_KM2.update({'J': 15000, 'A': 40000, 'M': 60000, 'L': 100000, 'X': 280000})
PROV_KM2.update({'J': 3500, 'A': 7000, 'M': 10500, 'L': 16000, 'X': 45000})

POP_1936.update({
    'USA': 128.0, 'JAP': 97.0, 'CHI': 360.0, 'PRC': 1.5, 'MAN': 34.0, 'MEN': 5.0, 'SHX': 12.0,
    'GXC': 13.0, 'YUN': 12.0, 'XSM': 9.0, 'SIK': 4.0, 'TIB': 1.2, 'MON': 0.75, 'TAN': 0.07,
    'RAJ': 330.0, 'NEP': 5.5, 'BHU': 0.3, 'AFG': 7.0, 'SIA': 14.5, 'PHI': 15.5, 'CAN': 11.0,
    'AST': 6.8, 'NZL': 1.6, 'SAF': 10.0, 'MEX': 18.5, 'GUA': 2.1, 'HON': 1.0, 'ELS': 1.6, 'NIC': 0.8,
    'COS': 0.6, 'PAN': 0.5, 'CUB': 4.2, 'HAI': 2.8, 'DOM': 1.5, 'COL': 8.7, 'VEN': 3.4, 'ECU': 2.6,
    'PRU': 6.5, 'BOL': 3.0, 'CHL': 4.6, 'ARG': 12.8, 'PAR': 1.0, 'URU': 2.0, 'BRA': 39.0,
    'ETH': 10.0, 'LIB': 1.0, 'YEM': 3.5, 'OMA': 0.5, 'SAU': 3.0,
})
# popolazioni delle colonie fuori dall'Europa (milioni)
POP_COLONY.update({
    'KOR': 22.0, 'PRK': 0.0, 'TWN': 5.3, 'VNM': 18.0, 'LAO': 1.0, 'KHM': 3.0, 'IDN': 66.0, 'MYS': 4.5,
    'SGP': 0.6, 'LKA': 5.6, 'NGA': 20.0, 'GHA': 3.5, 'COD': 10.0, 'AGO': 3.5, 'MOZ': 4.0, 'KEN': 3.5,
    'TZA': 5.0, 'UGA': 3.5, 'SDN': 6.0, 'SDS': 0.0, 'MDG': 3.8, 'SEN': 1.6, 'MLI': 3.0, 'GIN': 2.0,
    'CIV': 4.0, 'BFA': 3.0, 'NER': 2.0, 'TCD': 1.5, 'CMR': 2.5, 'ZWE': 1.4, 'ZMB': 1.4, 'MWI': 1.6,
    'ERI': 0.6, 'SOM': 1.0, 'GUY': 0.33, 'SUR': 0.17, 'JAM': 1.1, 'PRI': 1.7, 'NAM': 0.36,
})
DEV.update({
    'USA': 1.0, 'CAN': 0.85, 'AST': 0.8, 'NZL': 0.8, 'JAP': 0.65, 'SAF': 0.5, 'ARG': 0.5, 'URU': 0.45,
    'CHL': 0.4, 'MEX': 0.3, 'BRA': 0.3, 'CUB': 0.35, 'MAN': 0.35, 'CHI': 0.2, 'RAJ': 0.2, 'PHI': 0.2,
    'SIA': 0.15, 'COL': 0.25, 'VEN': 0.3, 'PRU': 0.2, 'ECU': 0.15, 'BOL': 0.12, 'PAR': 0.12,
})
NAVAL_BASES += [
    (-157.95, 21.35, 10, 'Pearl Harbor'), (-122.3, 37.8, 8, 'San Francisco'), (-117.2, 32.7, 10, 'San Diego'),
    (-76.3, 36.95, 10, 'Norfolk'), (-74.0, 40.7, 6, 'New York'), (-122.6, 47.55, 6, 'Bremerton'),
    (132.55, 34.24, 10, 'Kure'), (139.67, 35.29, 10, 'Yokosuka'), (129.73, 33.16, 8, 'Sasebo'),
    (135.38, 35.47, 6, 'Maizuru'), (103.82, 1.29, 10, 'Singapore'), (114.17, 22.3, 6, 'Hong Kong'),
    (120.95, 14.5, 4, 'Cavite'), (151.2, -33.86, 8, 'Sydney'), (115.75, -32.05, 4, 'Fremantle'),
    (174.8, -36.8, 4, 'Auckland'), (18.43, -34.19, 6, 'Simonstown'), (72.83, 18.95, 6, 'Bombay'),
    (80.28, 13.08, 3, 'Madras'), (-63.6, 44.65, 6, 'Halifax'), (131.9, 43.1, 8, 'Vladivostok'),
    (121.6, 38.9, 6, 'Port Arthur'), (121.5, 31.2, 4, 'Shanghai'), (106.9, -6.1, 6, 'Batavia'),
    (112.7, -7.2, 6, 'Surabaya'), (106.7, 10.8, 4, 'Saigon'), (44.99, 12.79, 6, 'Aden'),
    (-79.9, 9.35, 6, 'Colón'), (-43.2, -22.9, 4, 'Rio de Janeiro'), (-58.37, -34.6, 4, 'Buenos Aires'),
    (-71.6, -33.0, 4, 'Valparaíso'), (39.67, -4.05, 3, 'Mombasa'), (-17.4, 14.7, 4, 'Dakar'),
    (55.3, 25.3, 2, 'Dubai'), (50.6, 26.2, 3, 'Bahrein'), (144.75, 13.45, 2, 'Guam'), (134.5, 7.3, 3, 'Palau'),
    (151.85, 7.45, 6, 'Truk'), (152.2, -4.2, 2, 'Rabaul'),
]
RESOURCES += [
    (-97.5, 32.0, 'oil', 80), (-98.5, 35.5, 'oil', 40), (-118.2, 34.0, 'oil', 30), (-91.5, 30.5, 'oil', 20),
    (-80.0, 41.5, 'oil', 6), (-66.5, 10.0, 'oil', 40), (-71.6, 10.6, 'oil', 30), (-97.9, 21.0, 'oil', 12),
    (-63.5, -22.0, 'oil', 3), (-81.3, -4.5, 'oil', 3), (-61.5, 10.3, 'oil', 6),
    (101.5, 2.5, 'rubber', 40), (103.5, 1.8, 'rubber', 30), (100.5, 5.5, 'rubber', 20), (106.0, -6.5, 'rubber', 25),
    (99.0, 3.0, 'rubber', 30), (110.0, -7.0, 'rubber', 10), (106.0, 11.5, 'rubber', 15), (80.5, 7.0, 'rubber', 10),
    (-60.0, -3.0, 'rubber', 4), (-9.5, 6.5, 'rubber', 6), (100.0, 7.5, 'rubber', 10),
    (117.0, 0.5, 'oil', 15), (103.0, -3.0, 'oil', 20), (101.0, 1.0, 'oil', 10), (114.5, 4.5, 'oil', 10),
    (95.0, 20.5, 'oil', 6), (94.5, 26.8, 'oil', 3), (51.5, 26.0, 'oil', 2),
    (-92.5, 47.5, 'steel', 80), (-87.6, 46.4, 'steel', 30), (-86.8, 33.5, 'steel', 20), (-66.8, 52.9, 'steel', 6),
    (-43.9, -20.0, 'steel', 20), (85.5, 22.0, 'steel', 30), (113.5, 30.2, 'steel', 12), (123.0, 41.0, 'steel', 30),
    (114.5, 36.5, 'steel', 12), (115.0, -24.0, 'steel', 10), (137.5, -33.0, 'steel', 12), (-70.6, -27.0, 'steel', 8),
    (127.6, 40.0, 'steel', 8), (141.0, 42.5, 'steel', 4),
    (-55.0, 5.0, 'aluminium', 20), (-58.3, 6.0, 'aluminium', 25), (-92.6, 34.5, 'aluminium', 12),
    (110.5, -1.5, 'aluminium', 12), (104.5, 0.9, 'aluminium', 10), (-13.5, 10.5, 'aluminium', 8),
    (-79.0, 50.5, 'aluminium', 10), (150.0, -24.0, 'aluminium', 2),
    (114.0, 25.5, 'tungsten', 60), (115.5, 24.8, 'tungsten', 20), (98.5, 16.5, 'tungsten', 16),
    (98.0, 13.0, 'tungsten', 8), (126.5, 36.5, 'tungsten', 10), (-66.0, -19.5, 'tungsten', 10),
    (-118.0, 37.5, 'tungsten', 8), (-108.5, 44.5, 'tungsten', 2),
    (166.5, -21.5, 'chromium', 12), (30.0, -19.5, 'chromium', 20), (29.8, -25.5, 'chromium', 20),
    (120.0, 16.0, 'chromium', 10), (85.5, 21.0, 'chromium', 8), (57.0, 50.5, 'chromium', 6),
    (-77.0, 21.5, 'chromium', 6), (-110.0, 45.0, 'chromium', 2),
    (-80.5, -3.6, 'aluminium', 2), (-46.5, -1.5, 'rubber', 2),
]
STRAITS += [
    ((-122.4, 37.8), (-122.47, 37.85), 'Golden Gate'), ((130.9, 33.95), (130.95, 33.88), 'Kanmon'),
    ((140.7, 41.6), (140.7, 41.15), 'Stretto di Tsugaru'), ((103.85, 1.35), (103.75, 1.5), 'Stretto di Johor'),
    ((-74.4, 40.6), (-74.05, 40.6), 'Narrows'), ((133.2, 34.4), (133.4, 34.2), 'Seto'),
    ((-75.0, 45.4), (-74.9, 45.6), 'San Lorenzo'), ((-70.8, -53.2), (-70.4, -52.8), 'Stretto di Magellano'),
    ((43.4, 12.7), (43.3, 12.4), 'Bab el-Mandeb'), ((32.3, 30.6), (32.35, 30.65), 'Canale di Suez'),
    ((-79.6, 9.1), (-79.7, 9.2), 'Canale di Panama'),
]
# canali e stretti da tenere navigabili
SEA_CHANNELS += [
    [(32.30, 31.25), (32.33, 30.60), (32.55, 30.25), (32.55, 29.95)],   # Suez
    [(-79.92, 9.35), (-79.70, 9.10), (-79.55, 8.95)],                    # Panama
    [(130.88, 33.97), (130.95, 33.93)],                                  # Kanmon
]
SEA_NAMES.update({
    'North Pacific Ocean': 'Oceano Pacifico', 'South Pacific Ocean': 'Pacifico meridionale',
    'South Atlantic Ocean': 'Atlantico meridionale', 'Indian Ocean': 'Oceano Indiano',
    'Arctic Ocean': 'Mar Glaciale Artico', 'Southern Ocean': 'Oceano Antartico',
    'Caribbean Sea': 'Mar dei Caraibi', 'Gulf of Mexico': 'Golfo del Messico', 'Bering Sea': 'Mare di Bering',
    'Sea of Okhotsk': 'Mare di Ochotsk', 'Sea of Japan': 'Mar del Giappone', 'East China Sea': 'Mar Cinese Orientale',
    'South China Sea': 'Mar Cinese Meridionale', 'Yellow Sea': 'Mar Giallo', 'Philippine Sea': 'Mar delle Filippine',
    'Coral Sea': 'Mar dei Coralli', 'Tasman Sea': 'Mar di Tasmania', 'Arabian Sea': 'Mar Arabico',
    'Bay of Bengal': 'Golfo del Bengala', 'Andaman Sea': 'Mare delle Andamane', 'Java Sea': 'Mar di Giava',
    'Banda Sea': 'Mar di Banda', 'Celebes Sea': 'Mar di Celebes', 'Sulu Sea': 'Mar di Sulu',
    'Timor Sea': 'Mar di Timor', 'Arafura Sea': 'Mar degli Arafura', 'Gulf of Aden': 'Golfo di Aden',
    'Hudson Bay': 'Baia di Hudson', 'Labrador Sea': 'Mare del Labrador', 'Baffin Bay': 'Baia di Baffin',
    'Gulf of Alaska': 'Golfo dell\'Alaska', 'Gulf of Guinea': 'Golfo di Guinea', 'Mozambique Channel': 'Canale di Mozambico',
    'Gulf of Thailand': 'Golfo del Siam', 'Bo Hai': 'Golfo di Bohai', 'Gulf of California': 'Golfo di California',
    'Laptev Sea': 'Mare di Laptev', 'East Siberian Sea': 'Mare della Siberia Orientale', 'Chukchi Sea': 'Mare dei Ciukci',
    'Beaufort Sea': 'Mare di Beaufort', 'Gulf of St. Lawrence': 'Golfo di San Lorenzo', 'Gulf of Oman': 'Golfo di Oman',
    'Molucca Sea': 'Mare delle Molucche', 'Bismarck Sea': 'Mare di Bismarck', 'Solomon Sea': 'Mare delle Salomone',
    'Great Australian Bight': 'Grande Baia Australiana', 'Gulf of Carpentaria': 'Golfo di Carpentaria',
    'Strait of Malacca': 'Stretto di Malacca', 'Makassar Strait': 'Stretto di Makassar', 'Flores Sea': 'Mar di Flores',
    'Rio de la Plata': 'Rio de la Plata', 'Gulf of Panama': 'Golfo di Panama', 'Sargasso Sea': 'Mar dei Sargassi',
    'Davis Strait': 'Stretto di Davis', 'Gulf of Tonkin': 'Golfo del Tonchino', 'Korea Strait': 'Stretto di Corea',
    'Taiwan Strait': 'Stretto di Formosa', 'Ross Sea': 'Mare di Ross', 'Weddell Sea': 'Mare di Weddell',
    'Scotia Sea': 'Mare di Scotia', 'Bass Strait': 'Stretto di Bass', 'Persian Gulf': 'Golfo Persico',
    'Red Sea': 'Mar Rosso', 'Caspian Sea': 'Mar Caspio',
})
SEA_ENCLOSED |= {'Mar dei Caraibi', 'Golfo del Messico', 'Mar del Giappone', 'Mar Cinese Orientale',
                 'Mar Giallo', 'Mar di Giava', 'Golfo del Siam', 'Golfo di Bohai', 'Stretto di Malacca',
                 'Stretto di Corea', 'Stretto di Formosa', 'Golfo di Aden', 'Golfo di Oman', 'Mar di Sulu',
                 'Mar di Celebes', 'Golfo del Tonchino', 'Golfo di San Lorenzo', 'Mar di Flores', 'Mar di Banda',
                 'Mare delle Molucche', 'Stretto di Makassar', 'Mare di Bismarck', 'Mare delle Salomone',
                 'Golfo di Panama', 'Rio de la Plata', 'Stretto di Bass', 'Golfo di California', 'Mar Cinese Meridionale'}
