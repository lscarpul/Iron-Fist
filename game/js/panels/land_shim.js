'use strict';
// Compatibilità: se l'interfaccia non offre ancora UI.registerPanel (shell HOI4), lo emula
// sopra i pannelli classici di ui.js. Con la nuova shell questo file non fa nulla.
(function () {
  if (UI.registerPanel) return;
  const panels = {}, sections = {};
  UI.registerPanel = function (p) {
    panels[p.id] = p;
    UI['panel_' + p.id] = () => {
      let h = p.render(C(S.player));
      for (const s of (sections[p.id] || []).sort((a, b) => a.order - b.order)) h += s.render(C(S.player));
      return h;
    };
    const nav = document.getElementById('tabs');
    if (nav && !nav.querySelector(`[data-tab="${p.id}"]`)) {
      const b = document.createElement('button');
      b.dataset.tab = p.id;
      b.textContent = p.title;
      nav.appendChild(b);
      nav.style.gridTemplateColumns = `repeat(${nav.children.length}, 1fr)`;
    }
  };
  UI.registerSection = function (tab, s) { (sections[tab] = sections[tab] || []).push(s); };
  const act = UI.act;
  UI.act = function (name, arg) {
    const all = [panels[this.tab], ...(sections[this.tab] || [])].filter(Boolean);
    for (const p of all) {
      if (p.actions && p.actions[name]) {
        p.actions[name](arg);
        this.dirty = true; this.lastPanel = '';
        return;
      }
    }
    return act.call(this, name, arg);
  };
  UI.open = tab => UI.setTab(tab);
  UI.notify = (text, o = {}) => log(text, o.kind === 'bad' ? 'bad' : o.kind === 'warn' ? 'warn' : '');
})();
