'use strict';

const SPEED_MS = [Infinity, 900, 450, 220, 100, 35];

function buildStartScreen() {
  const order = Object.keys(COUNTRY_DEFS).sort((a, b) => (COUNTRY_DEFS[b].major - COUNTRY_DEFS[a].major) || (COUNTRY_DEFS[b].civ + COUNTRY_DEFS[b].mil - COUNTRY_DEFS[a].civ - COUNTRY_DEFS[a].mil));
  const fac = { allies: 'Alleati', axis: 'Asse', comintern: 'Comintern' };
  const card = code => {
    const d = COUNTRY_DEFS[code];
    return `<button class="ccard ${d.major ? 'major' : ''}" data-code="${code}">
      <span class="flag big" style="background-color:${d.color}"></span>
      <span class="cname">${d.name}</span>
      <span class="cinfo">${icon('factory', 12)} ${d.civ + d.mil} · ${icon('division', 12)} ${d.inf + d.arm}${d.faction ? ` · ${fac[d.faction]}` : ''}</span>
    </button>`;
  };
  const pick = code => {
    const d = COUNTRY_DEFS[code];
    document.querySelectorAll('.ccard').forEach(b => b.classList.toggle('on', b.dataset.code === code));
    $('start-pick').innerHTML = `<span class="flag big" style="background-color:${d.color}"></span>
      <h3>${d.name}</h3><p class="sub">${d.major ? 'Grande potenza' : 'Nazione minore'}${d.faction ? ` · ${fac[d.faction]}` : ''}</p>
      <div class="stats">
        <div class="stat">${icon('factory', 16)}<b>${d.civ}</b><small>civili</small></div>
        <div class="stat">${icon('milfactory', 16)}<b>${d.mil}</b><small>militari</small></div>
        <div class="stat">${icon('division', 16)}<b>${d.inf + d.arm}</b><small>divisioni</small></div>
      </div>
      <button class="primary" id="btn-play">Gioca</button>`;
    $('btn-play').addEventListener('click', () => startGame(code));
  };
  $('majors').innerHTML = order.filter(c => COUNTRY_DEFS[c].major).map(card).join('');
  $('minors').innerHTML = order.filter(c => !COUNTRY_DEFS[c].major).map(card).join('');
  $('start-help').innerHTML = HELP_HTML;
  document.querySelectorAll('.ccard').forEach(b => {
    b.addEventListener('click', () => pick(b.dataset.code));
    b.addEventListener('dblclick', () => startGame(b.dataset.code));
  });
  pick(order[0]);
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
