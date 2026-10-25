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
- **Diplomazia** stile HOI4: tensione mondiale con soglie per ideologia, opinione tra paesi, obiettivi di guerra da giustificare, garanzie, fazioni, patti di non aggressione, pretese stile Monaco, lend-lease, pace bianca.
- **Conferenze di pace**: chi ha combattuto di più ha più punti partecipazione e sceglie per primo regioni o stati fantoccio.
- **Sudditi**: fantocci con autonomia che cresce col tempo, estrazione di equipaggiamento, annessione o indipendenza.
- **Intelligence**: agenzia con agenti, reti nei paesi stranieri, controspionaggio e operazioni (sabotaggio, furto di progetti, propaganda, resistenza, decrittazione, colpo di stato, governo collaborazionista).
- **Occupazione**: guarnigioni, resistenza e conformità per territorio, leggi di occupazione, sabotaggi e insurrezioni, governi collaborazionisti.
- **Eventi storici**: Anschluss, Monaco, Polonia 1939, Weserübung, Barbarossa…
- **IA** che costruisce, recluta, presidia il fronte, attacca quando è in vantaggio e tenta sbarchi.
- **Governo a parole** (tasto T): un'IA, locale con Ollama (es. Qwen 2.5 7B) o Claude, interpreta gli ordini scritti ed esegue diplomazia, economia, ricerca e focus. In modalità **Narratore**, come l'IA di Pax Historia, giudica cosa è plausibile e cambia il mondo: fonda città con punti vittoria, sposta regioni, fa nascere o annette nazioni, cambia regimi e capi, fa scoppiare guerre o firmare paci, e ogni qualche mese pubblica un notiziario di eventi.
- **Capitolazione** quando un paese perde gran parte del territorio: il governo resta in esilio finché i suoi alleati combattono, poi si tiene la conferenza di pace.

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
| `game/js/diplomacy.js` | tensione mondiale, opinione, obiettivi di guerra, patti, lend-lease, sudditi, conferenze di pace |
| `game/js/intel.js` | agenzie di intelligence, reti, operazioni di spionaggio |
| `game/js/occupation.js` | territori occupati: guarnigioni, resistenza, conformità, leggi di occupazione |
| `game/js/diplo-api.js` | azioni e riepilogo testuale per l'IA testuale (registro `GameActions`) |
| `game/js/panels/` | pannelli Diplomazia, Intelligence e Occupazione |
| `tests/sim.js` | simulazione headless: `node tests/sim.js G 3650` gioca 10 anni con la Germania |
| `game/js/render.js` | disegno della mappa su canvas |
| `game/js/ui.js` | pannelli, input mouse/tastiera, finestre |
| `game/js/main.js` | schermata iniziale e loop principale |
| `game/fonts/` | font Inter e Oswald (SIL Open Font License) |

## Prossimi passi possibili

- Bilanciamento (URSS troppo forte, Francia cade presto)
- Salvataggio/caricamento della partita
- Ricerca tecnologica, rifornimenti, marina e aviazione
- Icona dell'app

## Guerra terrestre e logistica (stile HOI4)

Codice in `game/js/land/` (regole) e `game/js/panels/` (schede Esercito e Logistica).

- **Division Designer**: griglia 5×5 di battaglioni di linea (fanteria, artiglieria, anticarro, contraerea, cavalleria, motorizzata, meccanizzata, carri, alpini, marines, paracadutisti) più 5 compagnie di supporto. Le statistiche si calcolano come in HOI4 (attacchi e difese sommati, organizzazione media, corazza 30% max + 70% media, perforazione 40% max + 60% media). Modificare un modello costa esperienza dell'esercito.
- **Progettista carri**: telaio, cannone, ruolo (carro, cacciacarri, semovente), corazza, motore, accessori; l'affidabilità decide guasti e logorio.
- **Combattimento**: 24 round orari al giorno con tiri di dado; attacco molle/duro contro difesa (chi difende) o sfondamento (chi attacca), colpi al 10% se assorbiti e al 40% oltre; corazza non perforata = danni dimezzati; larghezza di fronte per terreno (pianura 70+35 per direzione…) con penalità di sovraffollamento; trinceramento e pianificazione.
- **Logistica**: i rifornimenti partono dalla capitale, viaggiano su ferrovie (livelli 1-5, linee che si saturano) fino agli hub e da lì a cavallo o in camion. Fango, neve e infrastrutture cambiano raggio e velocità. Senza rifornimenti: logorio, niente recupero di organizzazione, fino a -80% ai danni.
- **Comando**: generali e feldmarescialli storici con abilità e tratti, armate da 24 divisioni, potere di comando per promozioni e tratti, forze speciali con limite di battaglioni.
