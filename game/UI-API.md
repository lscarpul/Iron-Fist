# Iron Fist: API dell'interfaccia (shell stile HOI4)

Branch: `ui/hoi4-interfaccia` (thread "Rifare l'interfaccia in stile HOI4").
Obiettivo: ogni sistema aggiunge la propria UI in un FILE SUO, senza toccare `ui.js`,
così i merge tra thread non si scontrano.

## Dove mettere il codice
- Un file per sistema: `game/js/panels/<sistema>.js` (es. `panels/ricerca.js`). I pannelli base della shell stanno in `game/js/ui-panels.js` (non toccarlo: registra sopra con lo stesso id).
- Aggiungi il tuo `<script src="js/panels/<sistema>.js">` in `game/index.html`
  nel blocco tra `<!-- PANELS:BEGIN -->` e `<!-- PANELS:END -->` (dopo ui.js, prima di main.js).

## Schede (tab) già previste, con id fissi
Stato: `politica`, `focus`, `ricerca`, `produzione`, `costruzione`, `commercio`, `logistica`, `diplomazia`, `intelligence`
Forze armate: `esercito`, `marina`, `aviazione`
Ogni scheda ha già un pannello base. Per sostituirlo interamente:

```js
UI.registerPanel({
  id: 'ricerca',            // uno degli id sopra (o uno nuovo)
  title: 'Ricerca',
  icon: 'research',          // chiave di ICONS (game/js/icons.js) oppure stringa SVG/emoji
  group: 'state',            // 'state' | 'military'
  order: 30,
  width: 520,                // larghezza pannello in px (default 440)
  render(p) { return '...html...'; },     // p = C(S.player); chiamata quando UI.dirty
  actions: { start(arg, el) { ... } },     // data-act="start" data-arg="..." dentro il pannello
  badge(p) { return null; },               // numero/testo sul bottone (es. slot ricerca liberi)
});
```

Per AGGIUNGERE una sezione a un pannello esistente senza sostituirlo
(es. legge commerciale dentro `commercio`, chat IA dentro `diplomazia`):

```js
UI.registerSection('diplomazia', { id: 'ai-chat', order: 5, render(p) { return '...'; }, actions: {...} });
```
Le sezioni sono ordinate per `order` (il pannello base usa 50).

Altri hook:
- `UI.registerTopStat({ id, order, icon, value(p) → html, tip(p) → html })` — risorsa nella barra in alto
  (già presenti: pp, stabilita, supporto, manodopera, fabbriche, equip, divisioni).
- `UI.notify(text, {icon, tab, kind:'info'|'warn'|'bad'})` — allerta nella striscia sotto la barra.
- `UI.open(tabId)`, `UI.dirty = true` per ridisegnare.
- Input di testo nei pannelli: dai al campo un `id` stabile; il ridisegno non lo cancella
  (la shell salva e ripristina valore/focus/cursore).

## Componenti CSS (usali invece di stili nuovi)
- `.sec` + `<h3>` titolo sezione; `.sub` sottotitolo grigio
- `.card` (`.cur` evidenziata, `.dim` disattivata), `.row`, `.grid2`, `.grid3`
- `.stat` → `<div class="stat"><b>12</b><small>civili</small></div>` dentro `.stats`
- `bar(frazione, 'org'|'str'|'eff'|'bad')` → barra di progresso
- `meter(frazione, etichetta)` → indicatore semicircolare (stabilità ecc.)
- `.tag` (`.good`/`.bad`/`.warn`), `.btn` = `<button>`, `button.primary`, `button.danger`
- `table.tbl` tabelle compatte; `.slot` slot (ricerca/produzione), `.empty` stato vuoto
- `icon('factory')` → SVG inline 16px; lista in `game/js/icons.js`
- `flag(country)` bandiera piccola, `flagBig(country)` grande

## Strumenti sulla mappa e comandi dell'esercito
- `UI.setMapTool({ hint, down(ti, e), move(ti, e), up(ti, e), cancel() })`: il tasto sinistro sulla mappa va allo
  strumento invece che alla selezione (usato dai piani di battaglia in `panels/armata.js`). `UI.setMapTool(null)` lo chiude;
  Esc e il clic destro lo annullano. `hint` compare in alto al centro.
- Mouse sulla mappa: sinistro = clic/riquadro di selezione (Shift o Ctrl aggiungono), destro o centrale trascinati = sposta la
  mappa, clic destro = muovi/attacca (`orderMove`), Ctrl+clic destro = trasferimento in treno (`orderMove(divs, ti, { rail: true })`).
- Tastiera: numeri = gruppi di controllo (`UI.ctrlGroup`, salvati in `S.ctrlGroups`), Ctrl+numero li salva, due volte centra
  la camera; + e − la velocità; frecce spostano la mappa.
- La barra delle armate (`#armybar`) è disegnata da `panels/armata.js` agganciandosi a `UI.update`; imposta `--armybar-h`
  su `#game` così `#unitbar` le sta sopra.
