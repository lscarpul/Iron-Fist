'use strict';

const SPEED_MS = [Infinity, 900, 450, 220, 100, 35];

function buildStartScreen() {
  const order = Object.keys(COUNTRY_DEFS).sort((a, b) => (COUNTRY_DEFS[b].major - COUNTRY_DEFS[a].major) || (COUNTRY_DEFS[b].civ + COUNTRY_DEFS[b].mil - COUNTRY_DEFS[a].civ - COUNTRY_DEFS[a].mil));
  const fac = { allies: 'Alleati', axis: 'Asse', comintern: 'Comintern' };
  const card = code => {
    const d = COUNTRY_DEFS[code];
    return `<button class="ccard ${d.major ? 'major' : ''}" data-code="${code}">
      <span class="flag big" style="background:${d.color}"></span>
      <span class="cname">${d.name}</span>
      <span class="cinfo">🏭 ${d.civ} · ⚙️ ${d.mil} · 🎖️ ${d.inf + d.arm}${d.faction ? ` · ${fac[d.faction]}` : ''}</span>
    </button>`;
  };
  $('majors').innerHTML = order.filter(c => COUNTRY_DEFS[c].major).map(card).join('');
  $('minors').innerHTML = order.filter(c => !COUNTRY_DEFS[c].major).map(card).join('');
  $('start-help').innerHTML = HELP_HTML;
  document.querySelectorAll('.ccard').forEach(b => b.addEventListener('click', () => startGame(b.dataset.code)));
}

function startGame(code) {
  newGame(code);
  $('start').classList.add('hidden');
  $('game').classList.remove('hidden');
  Render.init($('map'));
  UI.init();
  Render.centerOn(C(code).capital, Render.view.s * 1.6);
  UI.dirty = true;
  requestAnimationFrame(frame);
}

let lastFrame = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(250, now - lastFrame);
  lastFrame = now;
  if (!S.paused && !S.over && !UI.modalOpen) {
    acc += dt;
    const ms = SPEED_MS[S.speed];
    let n = 0;
    while (acc >= ms && n < 4) { tick(); acc -= ms; n++; if (UI.modalOpen || S.over) break; }
    if (n >= 4) acc = 0;
  } else acc = 0;
  Render.draw(UI.sel);
  UI.update();
  requestAnimationFrame(frame);
}

buildStartScreen();
