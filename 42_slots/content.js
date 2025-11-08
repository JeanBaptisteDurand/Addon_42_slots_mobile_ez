// 42 Slots Mobile Manager — Content Script (MV3)
// Public release hardening: storage API, error parsing, small UI/UX tweaks.

(() => {
  'use strict';

  // ---------- utils ----------
  const $ = (s) => document.querySelector(s);
  const el = (t, props = {}, html = '') => {
    const n = document.createElement(t);
    Object.assign(n, props);
    if (html) n.innerHTML = html;
    return n;
  };

  function getCsrf() {
    return (
      document.querySelector('meta[name="csrf-token"]')?.content ||
      document.querySelector('input[name="authenticity_token"]')?.value ||
      null
    );
  }

  function getUserIdFromCookie() {
    try {
      const cookies = document.cookie.split(';').map((s) => s.trim());
      for (const c of cookies) {
        if (c.startsWith('user.id=')) {
          const v = c.split('=')[1];
          const pre = v?.split('--')[0] || '';
          try {
            const dec = atob(pre);
            if (/^\d+$/.test(dec)) return dec;
          } catch {}
          if (/^\d+$/.test(pre)) return pre;
        }
      }
    } catch {}
    return null;
  }

  function roundToQuarterISO(localDateStr) {
    const d = new Date(localDateStr);
    const ms = 15 * 60 * 1000;
    return new Date(Math.floor(d.getTime() / ms) * ms).toISOString();
  }

  // ISO du prochain quart d’heure STRICTEMENT après maintenant, +30 min
  function nextQuarterPlus30ISO(now = new Date()) {
    const ms15 = 15 * 60 * 1000;
    const t = now.getTime();
    const nextQuarter = Math.floor(t / ms15) * ms15 + ms15;
    const minBegin = nextQuarter + 30 * 60 * 1000;
    return new Date(minBegin).toISOString();
  }

  function minutesBetween(aIso, bIso) {
    return Math.round((new Date(bIso) - new Date(aIso)) / 60000);
  }

  function toLocalString(iso) {
    const d = new Date(iso);
    return d.toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function ymd(date) {
    return date.toISOString().slice(0, 10);
  }

  async function parseError(res) {
    const text = await res.text().catch(() => '');
    // JSON ?
    try {
      const j = JSON.parse(text);
      const msg =
        j?.error ||
        j?.message ||
        (Array.isArray(j?.errors) ? j.errors.join(', ') : j?.errors);
      if (msg) return `Erreur ${res.status} — ${String(msg).slice(0, 300)}`;
    } catch {}
    // <title> HTML ?
    const m = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m) return `Erreur ${res.status} — ${m[1]}`;
    // fallback
    return `Erreur ${res.status} — ${text.slice(0, 200) || res.statusText || 'Inconnue'}`;
  }

  // ---------- panel UI ----------
  const panel = el('div');
  panel.setAttribute('data-42slots', 'panel');
  panel.style.cssText = `
    position:fixed;bottom:10px;left:6px;right:6px;background:#fff;padding:12px;border-radius:12px;
    box-shadow:0 12px 32px rgba(0,0,0,.18);z-index:2147483647;font:14px system-ui,-apple-system,Segoe UI,Roboto;
  `;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-weight:700">Slots 42 — Création</div>
      <div style="display:flex;gap:6px">
        <button id="themeToggle" type="button" style="padding:6px 10px;border-radius:8px;border:1px solid #ddd;background:#fff">Light</button>
        <button id="close" type="button" style="padding:6px 10px;border-radius:8px;border:1px solid #ddd;background:#fff">Fermer</button>
      </div>
    </div>
    <input id="b" type="datetime-local" step="900" style="width:100%;margin-bottom:8px;padding:8px;border-radius:8px;border:1px solid #ddd">
    <input id="e" type="datetime-local" step="900" style="width:100%;margin-bottom:8px;padding:8px;border-radius:8px;border:1px solid #ddd">
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input id="uid" type="number" inputmode="numeric" placeholder="user_id (ton id)" style="flex:1;padding:8px;border-radius:8px;border:1px solid #ddd">
      <button id="auto" type="button" style="padding:8px;border-radius:8px;border:1px solid #ddd">Auto</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:6px">
      <button id="post" type="button" style="flex:1;padding:10px;border-radius:8px;background:#2d8cff;color:#fff;border:0">Poster</button>
    </div>

    <hr style="margin:10px 0">

    <div style="font-weight:700;margin-bottom:8px">Mes slots</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button id="loadAll" type="button" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff">Charger mes slots</button>
      <button id="refresh" type="button" style="padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff">↻</button>
    </div>
    <div id="list" style="max-height:45vh;overflow:auto;border:1px solid #eee;border-radius:8px;padding:6px"></div>

    <div id="msg" style="margin-top:8px;color:#333;min-height:18px"></div>
  `;
  document.body.appendChild(panel);

  const msg = $('#msg'),
    bInp = $('#b'),
    eInp = $('#e'),
    uidInp = $('#uid'),
    autoBtn = $('#auto'),
    postBtn = $('#post'),
    closeBtn = $('#close'),
    loadAllBtn = $('#loadAll'),
    refreshBtn = $('#refresh'),
    listDiv = $('#list'),
    themeToggle = $('#themeToggle');

  const setMsg = (t, err = false) => {
    msg.style.color = err ? '#ff6b6b' : 'var(--fg)';
    msg.textContent = t || '';
  };

  // ---------- Theme via storage API (MV3-friendly) ----------
  async function getTheme() {
    try {
      const d = await chrome.storage.local.get({ slotsTheme: 'dark' });
      return d.slotsTheme === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }
  async function setTheme(v) {
    try {
      await chrome.storage.local.set({ slotsTheme: v });
    } catch {}
  }

  function applyTheme(mode) {
    const dark = mode === 'dark';
    panel.style.background = dark ? '#0f1115' : '#ffffff';
    panel.style.color = dark ? '#e6e6e6' : '#111';
    panel.style.boxShadow = dark ? '0 12px 32px rgba(0,0,0,.6)' : '0 12px 32px rgba(0,0,0,.18)';
    panel.style.border = dark ? '1px solid #222630' : 'none';
    panel.querySelectorAll('input,button,hr,#list').forEach((n) => {
      if (n.tagName === 'HR') {
        n.style.borderColor = dark ? '#2a2f3a' : '#eee';
      } else if (n.id === 'post') {
        n.style.background = '#2d8cff';
        n.style.color = '#fff';
        n.style.border = '0';
      } else {
        n.style.background = dark ? '#121620' : '#fff';
        n.style.color = dark ? '#e6e6e6' : '#111';
        n.style.border = `1px solid ${dark ? '#2a2f3a' : '#ddd'}`;
      }
    });
    panel.style.setProperty('--fg', dark ? '#e6e6e6' : '#333');
    themeToggle.textContent = dark ? 'Light' : 'Dark';
  }

  (async () => {
    applyTheme(await getTheme());
  })();

  themeToggle.addEventListener('click', async () => {
    const cur = await getTheme();
    const next = cur === 'dark' ? 'light' : 'dark';
    await setTheme(next);
    applyTheme(next);
  });

  // ---------- helpers ----------
  const guess = getUserIdFromCookie();
  if (guess) uidInp.value = guess;

  autoBtn.addEventListener('click', () => {
    const g = getUserIdFromCookie();
    setMsg(g ? 'user_id auto détecté' : 'user_id non détecté', !g);
    if (g) uidInp.value = g;
  });

  closeBtn.addEventListener('click', () => panel.remove());

  // ---------- création ----------
  postBtn.addEventListener('click', async () => {
    setMsg('Envoi en cours…');
    const csrf = getCsrf();
    if (!csrf) return setMsg('CSRF introuvable.', true);

    const bVal = bInp.value,
      eVal = eInp.value,
      uid = (uidInp.value || '').trim();
    if (!bVal || !eVal || !uid)
      return setMsg('Remplis begin, end et user_id.', true);

    const begin_at = roundToQuarterISO(bVal),
      end_at = roundToQuarterISO(eVal);

    if (minutesBetween(begin_at, end_at) < 30)
      return setMsg('Durée minimale 30 minutes.', true);
    if (new Date(begin_at) >= new Date(end_at))
      return setMsg('Erreur : début ≥ fin.', true);

    // règle: earliest = (prochaine quinzaine STRICTE) + 30 minutes
    const earliestISO = nextQuarterPlus30ISO();
    if (new Date(begin_at) < new Date(earliestISO)) {
      return setMsg(
        `Début trop tôt. Earliest: ${toLocalString(
          earliestISO
        )} (prochaine quinzaine + 30min)`,
        true
      );
    }

    const form = new URLSearchParams();
    form.set('slot[user_id]', uid);
    form.set('slot[begin_at]', begin_at);
    form.set('slot[end_at]', end_at);

    try {
      const res = await fetch('/slots.json', {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-CSRF-Token': csrf,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: form.toString(),
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (!res.ok) {
        const m = await parseError(res);
        return setMsg(m, true);
      }
      setMsg('OK — slot créé');
      await loadAll();
    } catch (e) {
      setMsg('Fetch error: ' + (e?.message || e), true);
    }
  });

  // ---------- listing (scan large) ----------
  const BACK_MONTHS = 6,
    FORWARD_DAYS = 14,
    CHUNK_DAYS = 14;

  async function fetchChunk(startYmd, endYmd) {
    const url = `/slots.json?start=${encodeURIComponent(
      startYmd
    )}&end=${encodeURIComponent(endYmd)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  }

  async function loadAll() {
    setMsg('Chargement…');
    listDiv.innerHTML = '';
    const now = new Date(),
      startBase = new Date(now),
      endBase = new Date(now.getTime() + FORWARD_DAYS * 86400000);
    startBase.setMonth(now.getMonth() - BACK_MONTHS);

    const all = [];
    let cur = new Date(startBase);
    while (cur < endBase) {
      const s = ymd(cur),
        e = ymd(
          new Date(Math.min(endBase, new Date(cur.getTime() + CHUNK_DAYS * 86400000)))
        );
      try {
        // eslint-disable-next-line no-await-in-loop
        const chunk = await fetchChunk(s, e);
        if (Array.isArray(chunk) && chunk.length) all.push(...chunk);
      } catch (err) {
        // on continue, mais on affiche une info
        console.warn('Chunk error', err);
      }
      cur = new Date(cur.getTime() + CHUNK_DAYS * 86400000);
    }
    const seen = new Set(),
      uniq = [];
    for (const it of all) {
      const k = String(it.id);
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(it);
      }
    }
    renderSlots(uniq.sort((a, b) => new Date(a.start) - new Date(b.start)));
    setMsg(uniq.length ? `${uniq.length} slot(s) chargés.` : 'Aucun slot trouvé.');
  }

  function renderSlots(arr) {
    listDiv.innerHTML = '';
    if (!Array.isArray(arr) || !arr.length) {
      listDiv.innerHTML = '<div style="color:#888">Aucun slot.</div>';
      return;
    }
    for (const it of arr) {
      let group = [];
      if (Array.isArray(it.ids)) group = it.ids.map(String);
      else if (typeof it.ids === 'string')
        group = it.ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (!group.length && it.id) group = [String(it.id)];
      const firstId = group[0];

      // Détection "reserved"
      const isReserved =
        (typeof it.status === 'string' && it.status.toLowerCase() === 'reserved') ||
        /reserved/i.test(it.title || '');

      const card = el('div');
      card.style.cssText =
        'border:1px solid #eee;border-radius:8px;padding:8px;margin-bottom:8px';
      const badge = isReserved
        ? `<span style="font-size:12px;padding:2px 6px;border-radius:999px;border:1px solid #999;margin-left:8px;opacity:.8">reserved</span>`
        : '';
      card.innerHTML = `
        <div style="font-weight:600;display:flex;align-items:center">
          <span>${(it.title || 'Available')}</span>${badge}
        </div>
        <div>Début : ${toLocalString(it.start)}</div>
        <div>Fin&nbsp;&nbsp;: ${toLocalString(it.end)}</div>
        <div style="margin:6px 0;color:#666">Groupe: ${group.join(', ')}</div>
        <div class="btn-row" style="display:flex;gap:6px;flex-wrap:wrap"></div>
      `;
      const row = card.querySelector('.btn-row');
      if (!isReserved) {
        const delBtn = el('button', { className: 'btn-del-group', type: 'button' });
        delBtn.textContent = 'Supprimer';
        delBtn.dataset.first = firstId;
        delBtn.dataset.ids = group.join(',');
        delBtn.style.cssText =
          'padding:8px;border-radius:8px;border:1px solid #ddd;background:#fff';
        delBtn.addEventListener('click', async (e) => {
          const first = e.currentTarget.getAttribute('data-first');
          const ids = e.currentTarget.getAttribute('data-ids');
          try {
            await deleteGroupSingleCall(first, ids);
            await loadAll();
          } catch (err) {
            setMsg(String(err?.message || err), true);
          }
        });
        row.appendChild(delBtn);
      }
      listDiv.appendChild(card);
    }
    // ré-appliquer thème pour nouveaux éléments
    getTheme().then(applyTheme);
  }

  // ---------- delete (single call) ----------
  async function deleteGroupSingleCall(firstId, idsCsv) {
    const csrf = getCsrf();
    if (!csrf) throw new Error('CSRF introuvable.');

    const body = new URLSearchParams();
    body.set('_method', 'delete');
    body.set('ids', idsCsv);
    body.set('confirm', 'false');
    body.set('_', String(Date.now()));
    body.set('authenticity_token', csrf);

    setMsg(`Suppression… (${idsCsv})`);
    const res = await fetch(`/slots/${encodeURIComponent(firstId)}.json`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': csrf,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: body.toString(),
      credentials: 'same-origin',
      cache: 'no-store'
    });

    if (!res.ok) {
      const m = await parseError(res);
      throw new Error(m);
    }
    setMsg('Groupe supprimé.');
  }

  // ---------- actions ----------
  loadAllBtn.addEventListener('click', loadAll);
  refreshBtn.addEventListener('click', loadAll);
  loadAll();
  panel.scrollIntoView({ behavior: 'smooth', block: 'end' });
})();
