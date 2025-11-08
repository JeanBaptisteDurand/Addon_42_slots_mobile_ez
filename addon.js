// ==UserScript==
// @name         42 Slots Mobile Manager v4 (single-call group delete)
// @namespace    https://profile.intra.42.fr/
// @match        https://profile.intra.42.fr/slots*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------- utils ----------
  const $ = (s) => document.querySelector(s);
  const el = (t, props={}, html='') => { const n=document.createElement(t); Object.assign(n, props); if(html) n.innerHTML=html; return n; };

  function getCsrf() {
    return document.querySelector('meta[name="csrf-token"]')?.content
        || document.querySelector('input[name="authenticity_token"]')?.value
        || null;
  }
  function getUserIdFromCookie() {
    const cookies = document.cookie.split(';').map(s => s.trim());
    for (const c of cookies) {
      if (c.startsWith('user.id=')) {
        const v = c.split('=')[1]; const pre = v?.split('--')[0] || '';
        try { const dec = atob(pre); if (/^\d+$/.test(dec)) return dec; } catch {}
        if (/^\d+$/.test(pre)) return pre;
      }
    }
    return null;
  }
  function roundToQuarterISO(localDateStr) {
    const d = new Date(localDateStr); const ms = 15*60*1000;
    return new Date(Math.floor(d.getTime()/ms)*ms).toISOString();
  }
  function minutesBetween(aIso, bIso) {
    return Math.round((new Date(bIso) - new Date(aIso)) / 60000);
  }
  function toLocalString(iso) {
    const d = new Date(iso);
    return d.toLocaleString([], {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
  function ymd(date) { return date.toISOString().slice(0,10); }

  // ---------- UI ----------
  const panel = el('div');
  panel.style.cssText = `
    position:fixed;bottom:10px;left:6px;right:6px;background:#fff;padding:12px;border-radius:12px;
    box-shadow:0 12px 32px rgba(0,0,0,.18);z-index:999999;font:14px system-ui,-apple-system,Segoe UI,Roboto;
  `;
  panel.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px">Slots 42 — Création</div>
    <input id="b" type="datetime-local" step="900" style="width:100%;margin-bottom:8px;padding:8px;border-radius:8px;border:1px solid #ddd">
    <input id="e" type="datetime-local" step="900" style="width:100%;margin-bottom:8px;padding:8px;border-radius:8px;border:1px solid #ddd">
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input id="uid" type="number" placeholder="user_id (ton id)" style="flex:1;padding:8px;border-radius:8px;border:1px solid #ddd">
      <button id="auto" style="padding:8px;border-radius:8px;border:1px solid #ddd">Auto</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:6px">
      <button id="post" style="flex:1;padding:10px;border-radius:8px;background:#2d8cff;color:#fff;border:0">Poster</button>
      <button id="close" style="padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff">Fermer</button>
    </div>

    <hr style="margin:10px 0">

    <div style="font-weight:700;margin-bottom:8px">Mes slots</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button id="loadAll" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff">Charger mes slots</button>
      <button id="refresh" style="padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff">↻</button>
    </div>
    <div id="list" style="max-height:45vh;overflow:auto;border:1px solid #eee;border-radius:8px;padding:6px"></div>

    <div id="msg" style="margin-top:8px;color:#333;min-height:18px"></div>
  `;
  document.body.appendChild(panel);

  const msg=$('#msg'), bInp=$('#b'), eInp=$('#e'), uidInp=$('#uid'),
        autoBtn=$('#auto'), postBtn=$('#post'), closeBtn=$('#close'),
        loadAllBtn=$('#loadAll'), refreshBtn=$('#refresh'), listDiv=$('#list');

  const guess = getUserIdFromCookie(); if (guess) uidInp.value = guess;
  autoBtn.onclick = () => { const g=getUserIdFromCookie(); setMsg(g?'user_id auto détecté':'user_id non détecté', !g); if(g) uidInp.value=g; };
  closeBtn.onclick = () => panel.remove();
  function setMsg(t, err=false){ msg.style.color = err?'red':'#333'; msg.textContent = t||''; }

  // ---------- création ----------
  postBtn.onclick = async () => {
    setMsg('Envoi en cours…');
    const csrf = getCsrf(); if(!csrf) return setMsg('CSRF introuvable.', true);
    const bVal=bInp.value, eVal=eInp.value, uid=(uidInp.value||'').trim();
    if(!bVal||!eVal||!uid) return setMsg('Remplis begin, end et user_id.', true);

    const begin_at=roundToQuarterISO(bVal), end_at=roundToQuarterISO(eVal);
    if (minutesBetween(begin_at,end_at)<30) return setMsg('Durée minimale 30 minutes.', true);
    if (new Date(begin_at)>=new Date(end_at)) return setMsg('Erreur : début ≥ fin.',true);

    const form=new URLSearchParams();
    form.set('slot[user_id]', uid);
    form.set('slot[begin_at]', begin_at);
    form.set('slot[end_at]',   end_at);

    try{
      const res=await fetch('/slots.json',{method:'POST',headers:{
        'Accept':'application/json, text/javascript, */*; q=0.01',
        'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token':csrf,'X-Requested-With':'XMLHttpRequest'
      },body:form.toString(),credentials:'same-origin'});
      const txt=await res.text();
      if(!res.ok) return setMsg(`Erreur ${res.status} — ${txt.slice(0,200)}`, true);
      setMsg('OK — slot créé'); await loadAll();
    }catch(e){ setMsg('Fetch error: '+e.message,true); }
  };

  // ---------- listing (scan large) ----------
  const BACK_MONTHS=6, FORWARD_DAYS=14, CHUNK_DAYS=14;
  async function fetchChunk(startYmd, endYmd){
    const url=`/slots.json?start=${encodeURIComponent(startYmd)}&end=${encodeURIComponent(endYmd)}`;
    const res=await fetch(url,{method:'GET',headers:{
      'Accept':'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With':'XMLHttpRequest'
    },credentials:'same-origin'});
    if(!res.ok) throw new Error(`GET ${res.status} ${url}`);
    return res.json();
  }
  async function loadAll(){
    setMsg('Chargement…'); listDiv.innerHTML='';
    const now=new Date(), startBase=new Date(now), endBase=new Date(now.getTime()+FORWARD_DAYS*86400000);
    startBase.setMonth(now.getMonth()-BACK_MONTHS);
    const all=[]; let cur=new Date(startBase);
    while(cur<endBase){
      const s=ymd(cur), e=ymd(new Date(Math.min(endBase, new Date(cur.getTime()+CHUNK_DAYS*86400000))));
      try{ /* eslint no-await-in-loop: off */ const chunk=await fetchChunk(s,e); if(Array.isArray(chunk)&&chunk.length) all.push(...chunk); }catch{}
      cur=new Date(cur.getTime()+CHUNK_DAYS*86400000);
    }
    const seen=new Set(), uniq=[];
    for(const it of all){ const k=String(it.id); if(!seen.has(k)){ seen.add(k); uniq.push(it); } }
    renderSlots(uniq.sort((a,b)=> new Date(a.start)-new Date(b.start)));
    setMsg(uniq.length?`${uniq.length} slot(s) chargés.`:'Aucun slot trouvé.');
  }

  function renderSlots(arr){
    listDiv.innerHTML='';
    if(!Array.isArray(arr)||!arr.length){ listDiv.innerHTML='<div style="color:#666">Aucun slot.</div>'; return; }
    for(const it of arr){
      let group=[];
      if(Array.isArray(it.ids)) group = it.ids.map(String);
      else if(typeof it.ids==='string') group = it.ids.split(',').map(s=>s.trim()).filter(Boolean);
      if(!group.length && it.id) group=[String(it.id)];
      const firstId = group[0];

      const card=el('div'); card.style.cssText='border:1px solid #eee;border-radius:8px;padding:8px;margin-bottom:8px';
      card.innerHTML=`
        <div style="font-weight:600">${it.title || 'Available'}</div>
        <div>Début : ${toLocalString(it.start)}</div>
        <div>Fin&nbsp;&nbsp;: ${toLocalString(it.end)}</div>
        <div style="margin:6px 0;color:#666">Groupe: ${group.join(', ')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-del-group" data-first="${firstId}" data-ids="${group.join(',')}" style="padding:8px;border-radius:8px;border:1px solid #ddd;background:#fff">Supprimer</button>
        </div>
      `;
      listDiv.appendChild(card);
    }
    listDiv.querySelectorAll('.btn-del-group').forEach(btn=>{
      btn.onclick = async (e)=>{
        const first = e.currentTarget.getAttribute('data-first');
        const ids   = e.currentTarget.getAttribute('data-ids');
        await deleteGroupSingleCall(first, ids);
        await loadAll();
      };
    });
  }

  // ---------- delete (UN SEUL CALL, comme l’UI 42) ----------
  async function deleteGroupSingleCall(firstId, idsCsv){
    const csrf=getCsrf(); if(!csrf) throw new Error('CSRF introuvable.');
    const body=new URLSearchParams();
    body.set('_method','delete');            // override rails
    body.set('ids', idsCsv);                 // la liste complète
    body.set('confirm','false');             // comme ta trace
    body.set('_', String(Date.now()));       // cache-buster
    body.set('authenticity_token', csrf);    // certains endpoints le veulent dans le form

    setMsg(`Suppression… (${idsCsv})`);
    const res=await fetch(`/slots/${encodeURIComponent(firstId)}.json`,{
      method:'POST',
      headers:{
        'Accept':'application/json, text/javascript, */*; q=0.01',
        'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token':csrf,
        'X-Requested-With':'XMLHttpRequest',
      },
      body: body.toString(),
      credentials:'same-origin'
    });
    const txt=await res.text();
    if(!res.ok) throw new Error(`Delete group -> ${res.status}: ${txt.slice(0,160)}`);
    setMsg('Groupe supprimé.');
  }

  // ---------- actions ----------
  $('#loadAll').onclick = loadAll;
  $('#refresh').onclick = loadAll;
  loadAll();
  panel.scrollIntoView({behavior:'smooth',block:'end'});
})();
