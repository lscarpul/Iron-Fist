# Iron Fist

Gioco di strategia "grand strategy" ispirato a Hearts of Iron IV. Il mondo intero, 1936–1946.
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

- **Mappa a province reali come in HOI4**: il mondo intero con i confini del 1936, 13503 province, 1542 stati, 384 regioni strategiche, 82 nazioni con tag HOI4 (colonie comprese, Cina divisa tra i signori della guerra), terreno reale (montagna, colline, foresta, palude, deserto, urbano, pianura), fiumi, ferrovie, porti, risorse e punti vittoria. Modalità mappa: politica, terreno, stati, regioni, infrastrutture, ferrovie, risorse. Dettagli in [docs/MAPPA.md](docs/MAPPA.md).
- **Tempo reale con pausa** (Spazio, velocità 1–5), dal 1° gennaio 1936.
- **Economia**: fabbriche civili (costruiscono) e militari (producono equipaggiamento), manodopera, potere politico.
- **Focus nazionali**: industria, riarmo, dottrine, corazzati, mobilitazione…
- **Ricerca** (scheda Ricerca): 2–3 slot, tecnologie con anno storico e penalità d'anticipo (+200% di tempo per anno), bonus di ricerca dai focus che annullano la penalità.
- **Dottrine terrestri**: Guerra di movimento, Potenza di fuoco superiore, Grande piano di battaglia, Assalto di massa, sbloccate con l'esperienza dell'esercito; trinceramento e pianificazione per le divisioni ferme.
- **Nucleare**: Ricerca atomica, reattore, bomba atomica (1945), Progetto Manhattan.
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
| `game/js/data.js` | nazioni europee, unità, focus, eventi storici |
| `game/js/countries-world.js` | nazioni del resto del mondo ed eventi (Etiopia, Cina, Pearl Harbor...) |
| `game/js/map.js` | generazione della griglia esagonale e del terreno |
| `game/js/game.js` | stato, ciclo giornaliero, economia, combattimento, diplomazia |
| `game/js/ai.js` | intelligenza artificiale delle nazioni |
| `game/js/research.js` | tecnologie, dottrine terrestri, armi nucleari (logica e IA) |
| `game/js/panels/ricerca.js` | scheda Ricerca (tecnologie, dottrine, nucleare) |
| `game/js/render.js` | disegno della mappa su canvas |
| `game/js/ui.js` | pannelli, input mouse/tastiera, finestre |
| `game/js/main.js` | schermata iniziale e loop principale |
| `game/fonts/` | font Inter e Oswald (SIL Open Font License) |

## Prossimi passi possibili

- Bilanciamento (URSS troppo forte, Francia cade presto)
- Salvataggio/caricamento della partita
- Ricerca tecnologica, rifornimenti, marina e aviazione
- Icona dell'app
