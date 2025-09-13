import { useEffect } from 'react'
import AppHeader from './components/AppHeader';
import Slides from './components/Slides';
import AppFooter from './components/AppFooter';

// Évite les doubles initialisations (React StrictMode en dev)
let __legacyCleanup: null | (() => void) = null;

export default function App() {
  useEffect(() => {
    if (__legacyCleanup) return __legacyCleanup;

    const VERSION = '1.1.0';
    const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null;

    // DOM refs
    const slides = $('#slides') as HTMLElement;
    const tabs = { player: $('#toPlayer') as HTMLButtonElement, lib: $('#toLibrary') as HTMLButtonElement, settings: $('#toSettings') as HTMLButtonElement };
    const pagerBtns = Object.values(tabs);

    const audio = $('#audio') as HTMLAudioElement;
    const nowName = $('#nowName') as HTMLElement;
    const nowUrl = $('#nowUrl') as HTMLElement;
    const nowMeta = $('#nowMeta') as HTMLElement;
    const playPause = $('#playPause') as HTMLButtonElement;
    const autoResume = $('#autoResume') as HTMLInputElement;
    const showLockInfo = $('#showLockInfo') as HTMLInputElement;
    const logBox = $('#logBox') as HTMLElement;
    const logEntries = $('#logEntries') as HTMLElement;
    const toggleLog = $('#toggleLog') as HTMLButtonElement;
    const copyLog = $('#copyLog') as HTMLButtonElement | null;

    const streamList = $('#streamList') as HTMLElement;
    const addQuick = $('#addQuick') as HTMLButtonElement;

    const form = $('#streamForm') as HTMLFormElement;
    const fId = $('#streamId') as HTMLInputElement;
    const fName = $('#streamName') as HTMLInputElement;
    const fUrl = $('#streamUrl') as HTMLInputElement;
    const pasteUrl = $('#pasteUrl') as HTMLButtonElement | null;
    const fFmt = $('#streamFormat') as HTMLSelectElement;
    const fFav = $('#streamFav') as HTMLInputElement;
    const fNotes = $('#streamNotes') as HTMLInputElement;
    const deleteStream = $('#deleteStream') as HTMLButtonElement;
    const resetFormBtn = $('#resetForm') as HTMLButtonElement;
    const manageList = $('#manageList') as HTMLElement;

    const exportBtn = $('#exportJson') as HTMLButtonElement;
    const importInput = $('#importJson') as HTMLInputElement;

    const tryHttp = $('#tryHttp') as HTMLInputElement;
    const compactList = $('#compactList') as HTMLInputElement;
    const haptics = $('#haptics') as HTMLInputElement;
    const playerBgColor = $('#playerBgColor') as HTMLInputElement | null;

    const seedDemo = $('#seedDemo') as HTMLButtonElement;
    const nukeAll = $('#nukeAll') as HTMLButtonElement;
    const appVersion = $('#appVersion') as HTMLElement;

    const sleepMinutes = $('#sleepMinutes') as HTMLInputElement;
    const sleepLeft = $('#sleepLeft') as HTMLElement;

    // App state
    type Stream = { id: string; name: string; url: string; format?: string | null; favorite?: boolean; notes?: string | null };
    let streams: Stream[] = [];
    let settings = load('settings_v1', {
      autoResume: true,
      showLockInfo: true,
      tryHttp: false,
      compactList: false,
      haptics: true,
      useSSE: true,
      playerBg: null as string | null,
    });
    let lastId: string | null = load('lastId_v1', null);
    let sleepTimer: any = null;
    let sleepETA = 0;

    // SSE / Polling state
    let metaTimer: any = null; // interval de polling
    let es: EventSource | null = null; // EventSource courant
    let currentMeta = '';
    let lastShownAt = 0;

    if (appVersion) appVersion.textContent = VERSION;

    // Apply settings UI
    if (autoResume) autoResume.checked = !!settings.autoResume;
    if (showLockInfo) showLockInfo.checked = !!settings.showLockInfo;
    if (tryHttp) tryHttp.checked = !!settings.tryHttp;
    if (compactList) compactList.checked = !!settings.compactList;
    if (haptics) haptics.checked = !!settings.haptics;
    document.body.classList.toggle('compact', !!settings.compactList);

    function applyPlayerBg(){
      // Applique la couleur de fond et calcule un contraste texte/fond lisible
      const root = document.documentElement;
      if (settings.playerBg){
        root.style.setProperty('--player-bg', settings.playerBg);
        const fg = pickReadableText(settings.playerBg);
        root.style.setProperty('--player-fg', fg);
        // Teinte atténuée cohérente selon le contraste choisi
        const muted = fg === '#ffffff' ? 'rgba(255,255,255,0.8)' : '#6b7280';
        root.style.setProperty('--player-muted', muted);
      } else {
        root.style.removeProperty('--player-bg');
        root.style.removeProperty('--player-fg');
        root.style.removeProperty('--player-muted');
      }
    }

    // Choisit noir ou blanc selon le meilleur contraste (WCAG)
    function pickReadableText(bgHex: string){
      const bg = hexToRgb(bgHex);
      if (!bg) return '#111827';
      const contrastBlack = contrastRatio(luminance(bg), luminance({r:0,g:0,b:0}));
      const contrastWhite = contrastRatio(luminance(bg), luminance({r:255,g:255,b:255}));
      return contrastWhite >= contrastBlack ? '#ffffff' : '#111827';
    }
    function hexToRgb(hex: string): {r:number; g:number; b:number} | null{
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
      if (!m) return null;
      return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
    }
    function srgbToLinear(c:number){
      const s = c/255;
      return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4);
    }
    function luminance(rgb:{r:number; g:number; b:number}){
      const r = srgbToLinear(rgb.r), g = srgbToLinear(rgb.g), b = srgbToLinear(rgb.b);
      return 0.2126*r + 0.7152*g + 0.0722*b;
    }
    function contrastRatio(L1:number, L2:number){
      const a = Math.max(L1,L2) + 0.05;
      const b = Math.min(L1,L2) + 0.05;
      return a/b;
    }
    applyPlayerBg();
    if (playerBgColor) playerBgColor.value = settings.playerBg || '#f7f8fa';

    toggleLog?.addEventListener('click', () => {
      if (!logBox || !toggleLog) return;
      logBox.hidden = !logBox.hidden;
      toggleLog.classList.toggle('on', !logBox.hidden);
      toggleLog.setAttribute('aria-label', logBox.hidden ? 'Afficher le journal' : 'Masquer le journal');
    });

    copyLog?.addEventListener('click', async () => {
      const txt = logEntries?.textContent || '';
      try { await navigator.clipboard.writeText(txt); }
      catch {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        try { document.execCommand('copy'); } catch {}
        ta.remove();
      }
    });

    function addLog(msg: string, obj?: any){
      const time = new Date().toLocaleTimeString();
      const div = document.createElement('div');
      div.textContent = `[${time}] ${msg}`;
      if (obj) {
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(obj, null, 2);
        div.appendChild(pre);
      }
      logEntries?.appendChild(div);
      if (logBox) logBox.scrollTop = logBox.scrollHeight;
    }

    function setModeBadge(mode: string){ addLog('Mode meta : ' + mode); }

    // Storage
    function save(key: string, val: any){ localStorage.setItem(key, JSON.stringify(val)); }
    function load<T>(key: string, fallback: T): T { try{ return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }catch{ return fallback; } }

    async function saveStreams(){
      try{
        await fetch('/api/streams', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({streams}) });
      }catch(err){ console.error('Sauvegarde des flux échouée', err); }
    }
    function persistAll(){ save('settings_v1', settings); saveStreams(); }

    // Slides / pager
    let prevIdx = 0;
    function snapIndex(){
      if (!slides) return;
      const idx = Math.round(slides.scrollLeft / slides.clientWidth);
      pagerBtns.forEach((b,i)=>b?.classList.toggle('active', i===idx));
      if (idx !== prevIdx && idx === 1) { checkClipboard(); }
      prevIdx = idx;
    }
    slides?.addEventListener('scroll', () => { window.requestAnimationFrame(snapIndex); });
    tabs.player?.addEventListener('click', ()=>slides?.scrollTo({left:0, behavior:'smooth'}));
    tabs.lib?.addEventListener('click', () => { slides?.scrollTo({left:slides.clientWidth, behavior:'smooth'}); checkClipboard(); });
    tabs.settings?.addEventListener('click', ()=>slides?.scrollTo({left:slides.clientWidth*2, behavior:'smooth'}));

    async function checkClipboard(){
      if (!navigator.clipboard) return;
      try {
        let text = await navigator.clipboard.readText();
        text = text.trim();
        if (text && /^https?:\/\/\S+/i.test(text) && !fUrl.value) { fUrl.value = text; }
      } catch {}
    }
    pasteUrl?.addEventListener('click', async ()=>{
      if (!navigator.clipboard) return;
      try{ const text = (await navigator.clipboard.readText()).trim(); if (text) fUrl.value = text; }catch{}
    });

    function buzz(){ try{ if (settings.haptics && 'vibrate' in navigator) navigator.vibrate(10); }catch{} }

    // Rendering lists
    function renderLists(){
      // Player list
      if (streamList) streamList.innerHTML = '';
      streams
        .slice()
        .sort((a,b)=> (Number(!!b.favorite) - Number(!!a.favorite)) || a.name.localeCompare(b.name))
        .forEach(s=>{
          const li = document.createElement('li');
          const playing = (s.id===lastId && !audio.paused);
          li.className = 'item' + (s.id===lastId?' current':'');
          li.innerHTML = `
            <div class="meta">
              <div class="name">${escapeHTML(s.name)} ${s.favorite?'<span class="badge">★</span>':''}</div>
              <div class="sub">${escapeHTML(s.url)}</div>
            </div>
            <div class="actions">
              ${playing?'<span class="eq" aria-hidden="true"><span></span><span></span><span></span></span>':''}
              <button class="play-btn" title="${playing?'Stop':'Lire'}" aria-label="${playing?'Stop':'Lire'}">${playing?'■':'▶︎'}</button>
            </div>
          `;
          const btn = li.querySelector('.play-btn') as HTMLButtonElement;
          btn.addEventListener('click', ()=>{
            if (s.id===lastId && !audio.paused){ audio.pause(); audio.currentTime = 0; } else { selectAndPlay(s.id); }
          });
          streamList?.appendChild(li);
        });

      // Manage list
      if (manageList) manageList.innerHTML = '';
      streams.forEach((s, idx)=>{
        const li = document.createElement('li');
        li.className = 'item';
        li.innerHTML = `
          <div class="left">
            <button class="up-btn" title="Monter">↑</button>
            <button class="down-btn" title="Descendre">↓</button>
            <button class="fav-btn" title="Favori">${s.favorite?'★':'☆'}</button>
            <div class="meta">
              <div class="name">${escapeHTML(s.name)}</div>
              <div class="sub">${escapeHTML(s.url)} ${s.format?`· ${s.format.toUpperCase()}`:''} ${s.notes?`· ${escapeHTML(s.notes)}`:''}</div>
            </div>
          </div>
          <div class="actions">
            <button class="play-btn" title="Lire">▶︎</button>
            <button class="edit-btn" title="Éditer">✎</button>
            <button class="del-btn" title="Supprimer">🗑</button>
          </div>
        `;
        (li.querySelector('.up-btn') as HTMLButtonElement).addEventListener('click', ()=>{ move(idx, Math.max(0, idx-1)); });
        (li.querySelector('.down-btn') as HTMLButtonElement).addEventListener('click', ()=>{ move(idx, Math.min(streams.length-1, idx+1)); });
        (li.querySelector('.fav-btn') as HTMLButtonElement).addEventListener('click', ()=>{ s.favorite = !s.favorite; persistAll(); renderLists(); buzz(); });
        (li.querySelector('.edit-btn') as HTMLButtonElement).addEventListener('click', ()=>{ loadToForm(s); buzz(); });
        (li.querySelector('.del-btn') as HTMLButtonElement).addEventListener('click', ()=>{
          if(confirm(`Supprimer “${s.name}” ?`)){
            streams = streams.filter(x=>x.id!==s.id);
            if (lastId===s.id) { lastId = null; save('lastId_v1', lastId); }
            persistAll(); renderLists(); buzz();
          }
        });
        (li.querySelector('.play-btn') as HTMLButtonElement).addEventListener('click', ()=> selectAndPlay(s.id));
        manageList?.appendChild(li);
      });
    }

    function escapeHTML(s: any){ return String(s).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;' } as any)[m]); }

    function move(from: number, to: number){ if (from===to) return; const [it] = streams.splice(from,1); streams.splice(to,0,it); persistAll(); renderLists(); }

    function loadToForm(s: Stream){ fId.value = s.id; fName.value = s.name; fUrl.value = s.url; fFmt.value = s.format || ''; fFav.checked = !!s.favorite; fNotes.value = s.notes || ''; deleteStream.disabled = false; }
    function clearForm(){ fId.value = ''; form.reset(); fFmt.value = ''; deleteStream.disabled = true; }
    resetFormBtn?.addEventListener('click', clearForm);

    form?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const data: Stream = { id: fId.value || cryptoRandom(), name: fName.value.trim(), url: fUrl.value.trim(), format: (fFmt.value || null), favorite: !!fFav.checked, notes: (fNotes.value.trim() || null) };
      if (!data.name || !data.url) return;
      const existing = streams.find(s=>s.id===data.id);
      if (existing){ Object.assign(existing, data); } else { streams.push(data); }
      persistAll(); renderLists(); buzz(); clearForm();
    });

    deleteStream?.addEventListener('click', ()=>{
      const id = fId.value; if (!id) return; const s = streams.find(x=>x.id===id); if (!s) return;
      if (confirm(`Supprimer “${s.name}” ?`)){
        streams = streams.filter(x=>x.id!==id);
        if (lastId===id){ lastId=null; save('lastId_v1', lastId); }
        persistAll(); renderLists(); clearForm(); buzz();
      }
    });

    addQuick?.addEventListener('click', ()=>{
      clearForm(); fName.value = 'FIP hifi'; fUrl.value = 'http://icecast.radiofrance.fr/fip-hifi.aac'; fFmt.value = 'aac'; fFav.checked = true; slides?.scrollTo({left: slides.clientWidth, behavior: 'smooth'});
    });

    // Import / Export
    exportBtn?.addEventListener('click', ()=>{
      const payload = JSON.stringify({ version: VERSION, streams }, null, 2);
      const blob = new Blob([payload], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'streams.json'; a.click(); URL.revokeObjectURL(a.href);
    });
    importInput?.addEventListener('change', async (e: any)=>{
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      try{
        const data = JSON.parse(text);
        if (!Array.isArray(data.streams)) throw new Error('Format inattendu');
        for (const s of data.streams){
          if (!s.name || !s.url) continue;
          const hit = streams.find((x)=>x.name===s.name && x.url===s.url);
          if (!hit) streams.push({ id: cryptoRandom(), name: s.name, url: s.url, format: s.format ?? null, favorite: !!s.favorite, notes: s.notes ?? null });
        }
        persistAll(); renderLists(); alert('Import terminé ✅');
      }catch(err: any){ alert('Import impossible : ' + err.message); }
      finally { (importInput as HTMLInputElement).value = ''; }
    });

    // Patch metadata
    function showMeta(meta: string){
      if (!meta) return;
      const now = Date.now();
      if (meta === currentMeta && (now - lastShownAt) < 60_000) return;
      currentMeta = meta; lastShownAt = now; if (nowMeta) nowMeta.textContent = meta; addLog('Meta : ' + meta);
    }
    function getWaitMsForCurrent(){
      const cur = getCurrent(); if (!cur) return undefined;
      const m = (cur.notes || '').match(/wait=(\d{5,6})/); const val = m ? Number(m[1]) : undefined; if (!val) return undefined; return Math.max(5000, Math.min(300000, val));
    }

    async function refreshMetadataOnce(){
      const cur = getCurrent(); if (!cur) return;
      const q = new URLSearchParams({ url: cur.url, forceHttp: String(!!settings.tryHttp) });
      const wait = getWaitMsForCurrent(); if (wait) q.set('waitMs', String(wait));
      addLog("Requête d'informations (one-shot) pour " + cur.name);
      try{ const info = await fetch('/api/metadata?' + q.toString()).then(r=>r.json()); handleMetadataResponse(info); }
      catch(err: any){ const msg = err?.message || 'erreur'; if (nowMeta) nowMeta.textContent = msg; addLog('Erreur de requête : ' + msg); }
    }
    function handleMetadataResponse(info: any){
      if (info.ok) {
        const meta = info.StreamTitle || info.title || info['icy-name'];
        if (meta){ showMeta(meta); addLog('Diag (one-shot OK)', info); }
        else { if (nowMeta) nowMeta.textContent = 'Aucune information trouvée'; addLog('Aucune information trouvée (one-shot)', info); }
      } else { if (nowMeta) nowMeta.textContent = 'Aucune info (diag dans le journal)'; addLog('Diag (one-shot)', info); }
    }
    function startPolling(){ stopPolling(); setModeBadge('Polling'); refreshMetadataOnce(); metaTimer = setInterval(refreshMetadataOnce, 30000); }
    function stopPolling(){ if (metaTimer){ clearInterval(metaTimer); metaTimer=null; } }

    function startSSE(){
      stopSSE(); const cur = getCurrent(); if (!cur) return;
      const q = new URLSearchParams({ url: cur.url, forceHttp: String(!!settings.tryHttp) }); const wait = getWaitMsForCurrent(); if (wait) q.set('waitMs', String(wait));
      const sseUrl = '/api/metadata/live?' + q.toString(); addLog('Connexion SSE : ' + sseUrl); es = new EventSource(sseUrl); setModeBadge('SSE');
      es.addEventListener('open', ()=> addLog('SSE ouvert'));
      es.addEventListener('status', (e: any) => { const data = safeJSON(e.data); addLog('SSE status', data); if (data?.StreamTitle) showMeta(data.StreamTitle); else if (!currentMeta && data?.reason && nowMeta) nowMeta.textContent = '…'; });
      es.addEventListener('metadata', (e: any) => { const data = safeJSON(e.data); const meta = data?.StreamTitle || data?.title || data?.['icy-name']; if (meta) showMeta(meta); });
      es.addEventListener('end', (_e: any) => { addLog('SSE terminé'); stopSSE(); startPolling(); });
      es.onerror = (_e) => { addLog('SSE erreur (bascule en polling)'); stopSSE(); startPolling(); };
    }
    function stopSSE(){ if (es){ try{ es.close(); }catch{} es=null; } }
    function safeJSON(s: string){ try{ return JSON.parse(s); }catch{ return null; } }

    // Playback
    playPause?.addEventListener('click', ()=>{ if (audio.paused){ if (audio.ended || audio.readyState === 0) audio.load(); audio.play().catch(showPlayError); } else { audio.pause(); audio.currentTime = 0; } });
    audio.addEventListener('play', ()=>{
      if (playPause){ playPause.textContent = '■'; playPause.setAttribute('aria-label','Stop'); }
      setMediaSession(); currentMeta = ''; lastShownAt = 0; if (nowMeta) nowMeta.textContent = '';
      if (settings.useSSE){ startSSE(); } else { startPolling(); }
      renderLists();
    });
    audio.addEventListener('pause', ()=>{
      if (playPause){ playPause.textContent = '▶︎'; playPause.setAttribute('aria-label','Lecture'); }
      stopSSE(); stopPolling(); renderLists();
    });
    audio.addEventListener('error', ()=>{ addLog('Erreur audio'); });

    function showPlayError(err: any){ addLog('Lecture impossible', err); alert('Lecture impossible. Voir journal.'); }
    function getCurrent(){ return streams.find(s=>s.id===lastId) || null; }
    function selectAndPlay(id: string){
      const s = streams.find(x=>x.id===id); if (!s) return;
      lastId = s.id; save('lastId_v1', lastId);
      if (nowName) nowName.textContent = s.name; if (nowUrl) nowUrl.textContent = s.url; audio.src = s.url; if (playPause) playPause.disabled = false; audio.play().catch(showPlayError);
    }

    function setMediaSession(){
      const nav: any = navigator as any;
      const cur = getCurrent(); if (!('mediaSession' in nav) || !cur) return;
      if (settings.showLockInfo){
        nav.mediaSession.metadata = new (window as any).MediaMetadata({ title: cur.name, artist: cur.notes || '', album: 'StreamDeck', artwork: [ { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAA', sizes:'64x64', type:'image/png' } ] });
      } else { nav.mediaSession.metadata = null; }
      nav.mediaSession.setActionHandler('play', ()=> audio.play().catch(()=>{}));
      nav.mediaSession.setActionHandler('pause', ()=> audio.pause());
      nav.mediaSession.setActionHandler('stop', ()=> { audio.pause(); audio.currentTime=0; });
      nav.mediaSession.setActionHandler('previoustrack', null);
      nav.mediaSession.setActionHandler('nexttrack', null);
    }

    // Sleep timer
    sleepMinutes?.addEventListener('input', ()=>{
      const mins = Math.max(0, Number(sleepMinutes.value||0));
      if (sleepTimer){ clearInterval(sleepTimer); sleepTimer = null; }
      if (mins===0){ sleepLeft.textContent = ''; return; }
      sleepETA = Date.now() + mins*60*1000;
      sleepTimer = setInterval(()=>{
        const left = Math.max(0, sleepETA - Date.now());
        const m = Math.floor(left/60000);
        const s = Math.floor((left%60000)/1000);
        sleepLeft.textContent = `Extinction dans ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if (left<=0){ clearInterval(sleepTimer); sleepTimer=null; audio.pause(); audio.currentTime=0; sleepLeft.textContent='Extinction effectuée.'; }
      }, 500);
    });

    // Settings toggles
    autoResume?.addEventListener('change', ()=>{ settings.autoResume = (autoResume as HTMLInputElement).checked; persistAll(); });
    showLockInfo?.addEventListener('change', ()=>{ settings.showLockInfo = (showLockInfo as HTMLInputElement).checked; persistAll(); setMediaSession(); });
    tryHttp?.addEventListener('change', ()=>{ settings.tryHttp = (tryHttp as HTMLInputElement).checked; persistAll(); });
    compactList?.addEventListener('change', ()=>{ settings.compactList = (compactList as HTMLInputElement).checked; persistAll(); document.body.classList.toggle('compact', settings.compactList); });
    haptics?.addEventListener('change', ()=>{ settings.haptics = (haptics as HTMLInputElement).checked; persistAll(); });
    playerBgColor?.addEventListener('input', ()=>{ settings.playerBg = (playerBgColor as HTMLInputElement).value; persistAll(); applyPlayerBg(); });

    // Seed / Reset
    seedDemo?.addEventListener('click', ()=>{ seedDemoData(true); renderLists(); alert('Exemples ajoutés.'); });
    nukeAll?.addEventListener('click', ()=>{
      if (confirm('Tout réinitialiser (flux + réglages) ?')){
        localStorage.clear(); streams = []; settings = { autoResume:true, showLockInfo:true, tryHttp:false, compactList:false, haptics:true, useSSE:true, playerBg:null } as any;
        lastId = null; saveStreams(); renderLists(); clearForm(); location.reload();
      }
    });

    function seedDemoData(force=false){
      if (streams.length && !force) return;
      const presets: Stream[] = [
        { id: cryptoRandom(), name:'FIP hifi', url:'http://icecast.radiofrance.fr/fip-hifi.aac', format:'aac', favorite:true, notes:'Radio France' },
        { id: cryptoRandom(), name:'FIP Rock', url:'http://icecast.radiofrance.fr/fiprock-midfi.mp3', format:'mp3', favorite:false, notes:'Thématique' },
        { id: cryptoRandom(), name:'Radio Swiss Jazz', url:'https://stream.srg-ssr.ch/m/rsj/aacp_96', format:'aac', favorite:false, notes:'AAC 96k' },
      ];
      streams = presets; persistAll();
    }

    function cryptoRandom(){ if ((crypto as any)?.randomUUID) return (crypto as any).randomUUID(); return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }

    async function loadStreams(){
      try{ const res = await fetch('/api/streams'); const arr = await res.json(); streams = Array.isArray(arr) ? arr : []; if (streams.length===0){ seedDemoData(); await saveStreams(); } }
      catch(err){ console.error('Chargement des flux impossible', err); }
    }

    // Démarrage
    (async () => {
      await loadStreams();
      renderLists();
      snapIndex();
      if (settings.autoResume && lastId){
        const cur = getCurrent();
        if (cur){
          nowName!.textContent = cur.name;
          nowUrl!.textContent = cur.url;
          audio.src = cur.url;
          playPause!.disabled = false;
        }
      }
    })();

    document.addEventListener('keydown', (e)=>{
      if (['ArrowLeft','ArrowRight'].includes(e.key)){
        const page = Math.round((slides?.scrollLeft || 0) / (slides?.clientWidth || 1));
        const target = e.key==='ArrowLeft' ? Math.max(0,page-1) : Math.min(2,page+1);
        slides?.scrollTo({left: target*(slides?.clientWidth || 0), behavior:'smooth'});
      }
    });

    // retourne une fonction de cleanup basique (idempotente)
    __legacyCleanup = () => {
      try { es?.close(); } catch {}
      es = null;
      if (metaTimer) { clearInterval(metaTimer); metaTimer = null; }
      if (sleepTimer) { clearInterval(sleepTimer); sleepTimer = null; }
    };
    return __legacyCleanup;
  }, [])

  return (
    <>
      <AppHeader />
      <Slides />
      <AppFooter />
    </>
  )
}
