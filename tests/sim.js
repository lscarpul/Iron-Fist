'use strict';
// Simulazione headless della logica di gioco (senza Electron né DOM).
// Uso: node tests/sim.js [codice giocatore] [giorni] [seme]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = ['util', 'data', 'map', 'game', 'diplomacy', 'intel', 'occupation', 'ai'];
function load(extra = '') {
  const ctx = {
    console, Math, Date, Set, Map, Float64Array, Int32Array, JSON,
    UI: { dirty: false, ask(title, text, buttons) { const b = buttons[0]; if (b && b.fn) b.fn(); }, gameOver() {} },
  };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'game', 'js');
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  if (extra) vm.runInContext(extra, ctx);
  return ctx;
}
module.exports = { load };

if (require.main === module) {
  const player = process.argv[2] || 'T';
  const days = +(process.argv[3] || 3650);
  const ctx = load();
  vm.runInContext(`newGame(${JSON.stringify(player)})`, ctx);
  const t0 = Date.now();
  for (let i = 0; i < days && !vm.runInContext('S.over', ctx); i++) vm.runInContext('tick()', ctx);
  console.log(vm.runInContext(`
    const lines = [];
    lines.push('Data: ' + dateLabel(S.day) + ' · tensione ' + Math.round(S.tension) + '%');
    for (const k in S.countries) {
      const c = S.countries[k];
      if (!c.alive) { lines.push(c.name + ': annessa'); continue; }
      lines.push(c.name + ': ' + c.tiles + ' terr, ' + c.civ + '/' + c.mil + ' fabbr' + (c.capitulated ? ' CAPITOLATA' : '') +
        (c.overlord ? ' suddito di ' + C(c.overlord).name + ' (' + AUTONOMY_LEVELS[c.autonomy.level].name + ' ' + Math.round(c.autonomy.score) + '%)' : '') +
        (S.occStats[k] ? ' · occupa ' + S.occStats[k].tiles + ' (res ' + Math.round(S.occStats[k].res) + ', conf ' + Math.round(S.occStats[k].comp) + ', guarn ' + Math.round(S.occStats[k].eff * 100) + '%)' : '') +
        ' · agenti ' + S.intel[k].agents + ' reti ' + Object.entries(S.intel[k].nets).map(([t, v]) => t + Math.round(v)).join(','));
    }
    lines.push('Guerre: ' + [...S.wars].join(' '));
    lines.push('Log: ' + S.log.filter(l => /pace|Conferenza|ottiene|fantoccio|collabor|Insurrez|indipendenza|capitolato|Spionaggio|liberata/.test(l.msg)).slice(0, 40).map(l => dateLabel(l.day) + ' ' + l.msg).join('\\n  '));
    lines.join('\\n');
  `, ctx));
  console.log('tempo', Date.now() - t0, 'ms');
}
