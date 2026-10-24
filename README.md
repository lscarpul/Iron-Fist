# Iron Fist

Gioco di strategia "grand strategy" ispirato a Hearts of Iron IV. Europa, 1936–1946.
È un'app desktop (Electron): si installa e si gioca senza browser e senza connessione.

## Giocare

Scarica l'installer per Windows dalla pagina **Releases** del repository (oppure dalla scheda **Actions**, artefatto `IronFist-windows`) e avvialo.

- `Iron Fist Setup x.y.z.exe`: installer classico con collegamento nel menu Start.
- `IronFist-x.y.z-portable.exe`: versione portatile, si avvia senza installare.

Comandi: Spazio pausa, tasti 1–5 velocità, clic per selezionare, clic destro per muovere/attaccare, F11 schermo intero.

## Sviluppo

Serve [Node.js](https://nodejs.org) 20 o superiore.

```bash
npm install
npm start          # avvia il gioco in una finestra
npm run dist:win   # crea installer e versione portatile in dist/
```

Per pubblicare una versione: aggiorna `version` in `package.json`, poi crea e invia un tag `vX.Y.Z`. GitHub Actions costruisce l'installer e lo allega alla release.

## Cosa c'è

- **Mappa esagonale d'Europa** con 23 nazioni, terreni (pianura, foresta, colline, montagna), capitali e città.
- **Tempo reale con pausa** (Spazio, velocità 1–5), dal 1° gennaio 1936.
- **Economia**: fabbriche civili (costruiscono) e militari (producono equipaggiamento), manodopera, potere politico.
- **Focus nazionali**: industria, riarmo, dottrine, corazzati, mobilitazione…
- **Esercito**: fanteria e corazzate, organizzazione e forza, rinforzi, ritirate, accerchiamenti, sbarchi dal mare.
- **Diplomazia**: dichiarazioni di guerra, garanzie, fazioni (Alleati, Asse, Comintern o la tua).
- **Eventi storici**: Anschluss, Monaco, Polonia 1939, Weserübung, Barbarossa…
- **IA** che costruisce, recluta, presidia il fronte, attacca quando è in vantaggio e tenta sbarchi.
- **Capitolazione** quando un paese perde gran parte del territorio.

## Struttura

| File | Contenuto |
|---|---|
| `electron/main.js` | finestra dell'app desktop |
| `game/index.html` | interfaccia del gioco |
| `game/js/data.js` | mappa ASCII, nazioni, unità, focus, eventi storici |
| `game/js/map.js` | generazione della griglia esagonale e del terreno |
| `game/js/game.js` | stato, ciclo giornaliero, economia, combattimento, diplomazia |
| `game/js/ai.js` | intelligenza artificiale delle nazioni |
| `game/js/render.js` | disegno della mappa su canvas |
| `game/js/ui.js` | pannelli, input mouse/tastiera, finestre |
| `game/js/main.js` | schermata iniziale e loop principale |
| `game/fonts/` | font Inter e Oswald (SIL Open Font License) |

## Prossimi passi possibili

- Bilanciamento (URSS troppo forte, Francia cade presto)
- Salvataggio/caricamento della partita
- Ricerca tecnologica, rifornimenti, marina e aviazione
- Icona dell'app
