/* StreamDeck Lite – v1.1.0 (SSE ready) */
(() => {
  const VERSION = '1.1.0';
  const els = sel => document.querySelectorAll(sel);
  const $ = sel => document.querySelector(sel);

  // DOM refs
  const slides = $('#slides');
  const tabs = { player: $('#toPlayer'), lib: $('#toLibrary'), settings: $('#toSettings') };
  const pagerBtns = Object.values(tabs);

  const audio = $('#audio');
  const nowName = $('#nowName');
  const nowUrl = $('#nowUrl');
  const nowMeta = $('#nowMeta');
  const playPause = $('#playPause');
  const autoResume = $('#autoResume');
  const showLockInfo = $('#showLockInfo');
  const logBox = $('#logBox');
  const logEntries = $('#logEntries');
  const toggleLog = $('#toggleLog');

  const streamList = $('#streamList');
  const addQuick = $('#addQuick');

  const form = $('#streamForm');
  const fId = $('#streamId');
  const fName = $('#streamName');
  const fUrl = $('#streamUrl');
  const pasteUrl = $('#pasteUrl');
  const fFmt = $('#streamFormat');
  const fFav = $('#streamFav');
  const fNotes = $('#streamNotes');
  const deleteStream = $('#deleteStream');
  const resetFormBtn = $('#resetForm');
  const manageList = $('#manageList');

  const exportBtn = $('#exportJson');
  const importInput = $('#importJson');

  const tryHttp = $('#tryHttp');
  const compactList = $('#compactList');
  const haptics = $('#haptics');

  const seedDemo = $('#seedDemo');
  const nukeAll = $('#nukeAll');
  const appVersion = $('#appVersion');

  const sleepMinutes = $('#sleepMinutes');
  const sleepLeft = $('#sleepLeft');

  const linkIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

  // App state
  let streams = [];
  let settings = load('settings_v1', {
    autoResume: true,
    showLockInfo: true,
    tryHttp: false,
    compactList: false,
    haptics: true,
    useSSE: true // NEW: utilise l’endpoint SSE par défaut
  });
  let lastId = load('lastId_v1', null);
  let sleepTimer = null;
  let sleepETA = 0;

  // SSE / Polling state
  let metaTimer = null;      // interval de polling
  let es = null;             // EventSource courant
  let currentMeta = '';      // dernière meta affichée

  appVersion.textContent = VERSION;

  // Apply settings UI
  autoResume.checked = !!settings.autoResume;
  showLockInfo.checked = !!settings.showLockInfo;
  tryHttp.checked = !!settings.tryHttp;
  compactList.checked = !!settings.compactList;
  haptics.checked = !!settings.haptics;
  document.body.classList.toggle('compact', settings.compactList);

  toggleLog.addEventListener('click', () => {
    logBox.hidden = !logBox.hidden;
    toggleLog.classList.toggle('on', !logBox.hidden);
    toggleLog.setAttribute('aria-label', logBox.hidden ? 'Afficher le journal' : 'Masquer le journal');
  });

  function addLog(msg, obj){
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.textContent = `[${time}] ${msg}`;
    if (obj) {
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(obj, null, 2);
      div.appendChild(pre);
    }
    logEntries.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
  }

  // ------- Storage helpers -------
  function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  function load(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{ return fallback; } }

  async function saveStreams(){
    try{
      await fetch('/api/streams', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({streams})
      });
    }catch(err){ console.error('Sauvegarde des flux échouée', err); }
  }

  function persistAll(){
    save('settings_v1', settings);
    saveStreams();
  }

  // ------- UI: slides / dots -------
  let prevIdx = 0;
  function snapIndex(){
    const idx = Math.round(slides.scrollLeft / slides.clientWidth);
    pagerBtns.forEach((b,i)=>b.classList.toggle('active', i===idx));
    if (idx !== prevIdx && idx === 1) {
      checkClipboard();
    }
    prevIdx = idx;
  }
  slides.addEventListener('scroll', () => { window.requestAnimationFrame(snapIndex); });
  tabs.player.addEventListener('click', ()=>slides.scrollTo({left:0, behavior:'smooth'}));
  tabs.lib.addEventListener('click', () => {
    slides.scrollTo({left:slides.clientWidth, behavior:'smooth'});
    checkClipboard();
  });
  tabs.settings.addEventListener('click', ()=>slides.scrollTo({left:slides.clientWidth*2, behavior:'smooth'}));

  async function checkClipboard(){
    if (!navigator.clipboard) return;
    try {
      let text = await navigator.clipboard.readText();
      text = text.trim();
      if (text && /^https?:\/\/\S+/i.test(text) && !fUrl.value) {
        fUrl.value = text;
      }
    } catch {}
  }

  pasteUrl?.addEventListener('click', async ()=>{
    if (!navigator.clipboard) return;
    try{
      const text = (await navigator.clipboard.readText()).trim();
      if (text) fUrl.value = text;
    }catch{}
  });

  // ------- Haptics (soft) -------
  function buzz(){
    try{ if (settings.haptics && 'vibrate' in navigator) navigator.vibrate(10); }catch{}
  }

  // ------- Streams rendering -------
  function renderLists(){
    // Player list (simple)
    streamList.innerHTML = '';
    streams
      .slice()
      .sort((a,b)=> (b.favorite - a.favorite) || a.name.localeCompare(b.name))
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
            <button class="open-btn" title="Ouvrir">${linkIcon}</button>
          </div>
        `;
        const btn = li.querySelector('.play-btn');
        btn.addEventListener('click', ()=>{
          if (s.id===lastId && !audio.paused){
            audio.pause();
            audio.currentTime = 0;
          } else {
            selectAndPlay(s.id);
          }
        });
        li.querySelector('.open-btn').addEventListener('click', ()=>{
          window.location.href = s.url;
        });
        streamList.appendChild(li);
      });

    // Manage list (edit/reorder/delete)
    manageList.innerHTML = '';
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
      li.querySelector('.up-btn').addEventListener('click', ()=>{ move(idx, Math.max(0, idx-1)); });
      li.querySelector('.down-btn').addEventListener('click', ()=>{ move(idx, Math.min(streams.length-1, idx+1)); });
      li.querySelector('.fav-btn').addEventListener('click', ()=>{
        s.favorite = !s.favorite; persistAll(); renderLists(); buzz();
      });
      li.querySelector('.edit-btn').addEventListener('click', ()=>{ loadToForm(s); buzz(); });
      li.querySelector('.del-btn').addEventListener('click', ()=>{
        if(confirm(`Supprimer “${s.name}” ?`)){
          streams = streams.filter(x=>x.id!==s.id);
          if (lastId===s.id) { lastId = null; save('lastId_v1', lastId); }
          persistAll(); renderLists(); buzz();
        }
      });
      li.querySelector('.play-btn').addEventListener('click', ()=> selectAndPlay(s.id));
      manageList.appendChild(li);
    });
  }

  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }

  function move(from, to){
    if (from===to) return;
    const [it] = streams.splice(from,1);
    streams.splice(to,0,it);
    persistAll(); renderLists();
  }

  // ------- Form -------
  function loadToForm(s){
    fId.value = s.id;
    fName.value = s.name;
    fUrl.value = s.url;
    fFmt.value = s.format || '';
    fFav.checked = !!s.favorite;
    fNotes.value = s.notes || '';
    deleteStream.disabled = false;
  }
  function clearForm(){
    fId.value = '';
    form.reset();
    fFmt.value = '';
    deleteStream.disabled = true;
  }
  resetFormBtn.addEventListener('click', clearForm);

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = {
      id: fId.value || cryptoRandom(),
      name: fName.value.trim(),
      url: fUrl.value.trim(),
      format: fFmt.value || null,
      favorite: !!fFav.checked,
      notes: fNotes.value.trim() || null
    };
    if (!data.name || !data.url) return;

    const existing = streams.find(s=>s.id===data.id);
    if (existing){
      Object.assign(existing, data);
    } else {
      streams.push(data);
    }
    persistAll(); renderLists(); buzz();
    clearForm();
  });

  deleteStream.addEventListener('click', ()=>{
    const id = fId.value;
    if (!id) return;
    const s = streams.find(x=>x.id===id);
    if (!s) return;
    if (confirm(`Supprimer “${s.name}” ?`)){
      streams = streams.filter(x=>x.id!==id);
      if (lastId===id){ lastId=null; save('lastId_v1', lastId); }
      persistAll(); renderLists(); clearForm(); buzz();
    }
  });

  addQuick.addEventListener('click', ()=>{
    clearForm();
    fName.value = 'FIP hifi';
    fUrl.value = 'http://icecast.radiofrance.fr/fip-hifi.aac';
    fFmt.value = 'aac';
    fFav.checked = true;
    slides.scrollTo({left: slides.clientWidth, behavior: 'smooth'});
  });

  // ------- Import / Export -------
  exportBtn.addEventListener('click', ()=>{
    const payload = JSON.stringify({ version: VERSION, streams }, null, 2);
    const blob = new Blob([payload], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'streams.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  importInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try{
      const data = JSON.parse(text);
      if (!Array.isArray(data.streams)) throw new Error('Format inattendu');
      for (const s of data.streams){
        if (!s.name || !s.url) continue;
        const hit = streams.find(x=>x.name===s.name && x.url===s.url);
        if (!hit) streams.push({
          id: cryptoRandom(),
          name: s.name, url: s.url,
          format: s.format ?? null,
          favorite: !!s.favorite,
          notes: s.notes ?? null
        });
      }
      persistAll(); renderLists(); alert('Import terminé ✅');
    }catch(err){
      alert('Import impossible : ' + err.message);
    } finally {
      importInput.value = '';
    }
  });

  // ------- Metadata: SSE + fallback polling -------
  async function refreshMetadataOnce(){
    const cur = getCurrent();
    if (!cur) return;
    const q = new URLSearchParams({
      url: cur.url,
      forceHttp: String(!!settings.tryHttp)
    });
    addLog("Requête d'informations (one-shot) pour " + cur.name);
    try{
      const info = await fetch('/api/metadata?' + q.toString()).then(r=>r.json());
      handleMetadataResponse(info);
    }catch(err){
      const msg = err?.message || 'erreur';
      nowMeta.textContent = msg;
      addLog('Erreur de requête : ' + msg);
    }
  }

  function handleMetadataResponse(info){
    if (info.ok) {
      const meta = info.StreamTitle || info.title || info['icy-name'];
      if (meta){
        if (meta !== currentMeta) {
          currentMeta = meta;
          nowMeta.textContent = meta;
          addLog('Meta (one-shot) : ' + meta, info);
        }
      } else {
        nowMeta.textContent = 'Aucune information trouvée';
        addLog('Aucune information trouvée (one-shot)', info);
      }
    } else {
      // Diagnostic lisible
      nowMeta.textContent = 'Aucune info (diag dans le journal)';
      addLog('Diag (one-shot)', info);
    }
  }

  function startPolling(){
    stopPolling();
    refreshMetadataOnce();
    metaTimer = setInterval(refreshMetadataOnce, 30000);
  }
  function stopPolling(){
    if (metaTimer){ clearInterval(metaTimer); metaTimer=null; }
  }

  function startSSE(){
    stopSSE(); // au cas où
    const cur = getCurrent();
    if (!cur) return;

    const q = new URLSearchParams({
      url: cur.url,
      forceHttp: String(!!settings.tryHttp)
    });
    const sseUrl = '/api/metadata/live?' + q.toString();

    addLog('Connexion SSE : ' + sseUrl);
    es = new EventSource(sseUrl);

    es.addEventListener('status', e => {
      const data = safeJSON(e.data);
      addLog('SSE status', data);
      // Affiche une info courte si rien encore
      if (!currentMeta && data?.reason) {
        nowMeta.textContent = '…';
      }
    });

    es.addEventListener('metadata', e => {
      const data = safeJSON(e.data);
      const meta = data?.StreamTitle || data?.title || data?.['icy-name'];
      if (meta && meta !== currentMeta){
        currentMeta = meta;
        nowMeta.textContent = meta;
        addLog('SSE metadata : ' + meta, data);
      }
    });

    es.addEventListener('end', _e => {
      addLog('SSE terminé');
      stopSSE();
      // Option : basculer automatiquement en polling si le flux coupe
      startPolling();
    });

    es.onerror = (_e) => {
      addLog('SSE erreur (bascule en polling)');
      stopSSE();
      startPolling();
    };
  }

  function stopSSE(){
    if (es){ try{ es.close(); }catch{} es=null; }
  }

  function safeJSON(s){ try{ return JSON.parse(s); }catch{ return null; } }

  // ------- Audio / Playback -------

  playPause.addEventListener('click', ()=>{
    if (audio.paused){
      if (audio.ended || audio.readyState === 0) audio.load();
      audio.play().catch(showPlayError);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  });

  audio.addEventListener('play', ()=>{
    playPause.textContent = '■';
    playPause.setAttribute('aria-label','Stop');
    setMediaSession();
    currentMeta = '';
    nowMeta.textContent = '';
    // Métadonnées live
    if (settings.useSSE){
      startSSE();
    } else {
      startPolling();
    }
    renderLists();
  });
  audio.addEventListener('pause', ()=>{
    playPause.textContent = '▶︎';
    playPause.setAttribute('aria-label','Lecture');
    setMediaSession();
    stopSSE();
    stopPolling();
    renderLists();
  });
  audio.addEventListener('ended', ()=>{
    playPause.textContent = '▶︎';
    playPause.setAttribute('aria-label','Lecture');
    setMediaSession();
    stopSSE();
    stopPolling();
    renderLists();
  });

  audio.addEventListener('error', ()=>{
    // Erreur potentielle de “mixed content” ou CORS
    playPause.disabled = false;
    const code = audio.error?.code;
    const msg = (code===4) ? 'Format/URL non supporté, ou accès bloqué.' : 'Erreur de lecture.';
    const cur = getCurrent();
    let extra = '';
    if (cur && /^http:\/\//i.test(cur.url)){
      extra = '\nAstuce: servez cette page en HTTP (pas HTTPS) pour autoriser les flux http:// sur iOS, ou utilisez “Ouvrir dans Safari”.';
    }
    stopSSE();
    stopPolling();
    alert(msg + extra);
  });

  function showPlayError(err){
    alert('Impossible de démarrer la lecture : ' + (err?.message || err));
  }

  function selectAndPlay(id){
    const s = streams.find(x=>x.id===id);
    if (!s) return;
    logEntries.textContent = '';
    addLog('Lecture de ' + s.name);
    lastId = id; save('lastId_v1', lastId);
    renderLists();
    nowName.textContent = s.name;
    nowUrl.textContent = s.url;
    nowMeta.textContent = '';
    currentMeta = '';

    let src = s.url;
    if (settings.tryHttp && /^https:\/\//i.test(src)){
      src = 'http:' + src.slice(6);
    }

    audio.src = src;
    playPause.disabled = false;

    audio.play().then(()=>{
      buzz();
      setMediaSession();
    }).catch(err=>{
      if (/NotAllowedError|denied/i.test(err?.name || '')){
        alert('iOS a besoin d’une interaction. Appuyez à nouveau sur Lecture.');
      } else {
        alert('Erreur de lecture : ' + (err?.message || err));
      }
    });
  }

  function getCurrent(){ return streams.find(s=>s.id===lastId) || null; }

  // ------- Media Session -------
  function setMediaSession(){
    if (!('mediaSession' in navigator)) return;
    const cur = getCurrent();
    if (!cur) return;

    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';

    if (settings.showLockInfo){
      navigator.mediaSession.metadata = new MediaMetadata({
        title: cur.name,
        artist: cur.notes || '',
        album: 'StreamDeck',
        artwork: [
          { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAA', sizes:'64x64', type:'image/png' }
        ]
      });
    } else {
      navigator.mediaSession.metadata = null;
    }

    navigator.mediaSession.setActionHandler('play', ()=> audio.play().catch(()=>{}));
    navigator.mediaSession.setActionHandler('pause', ()=> audio.pause());
    navigator.mediaSession.setActionHandler('stop', ()=> { audio.pause(); audio.currentTime=0; });
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
  }

  // ------- Sleep timer -------
  sleepMinutes.addEventListener('input', ()=>{
    const mins = Math.max(0, Number(sleepMinutes.value||0));
    if (sleepTimer){ clearInterval(sleepTimer); sleepTimer = null; }
    if (mins===0){
      sleepLeft.textContent = '';
      return;
    }
    sleepETA = Date.now() + mins*60*1000;
    sleepTimer = setInterval(()=>{
      const left = Math.max(0, sleepETA - Date.now());
      const m = Math.floor(left/60000);
      const s = Math.floor((left%60000)/1000);
      sleepLeft.textContent = `Extinction dans ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if (left<=0){
        clearInterval(sleepTimer); sleepTimer=null;
        audio.pause(); audio.currentTime=0; sleepLeft.textContent='Extinction effectuée.';
      }
    }, 500);
  });

  // ------- Settings toggles -------
  autoResume.addEventListener('change', ()=>{ settings.autoResume = autoResume.checked; persistAll(); });
  showLockInfo.addEventListener('change', ()=>{ settings.showLockInfo = showLockInfo.checked; persistAll(); setMediaSession(); });
  tryHttp.addEventListener('change', ()=>{ settings.tryHttp = tryHttp.checked; persistAll(); });
  compactList.addEventListener('change', ()=>{
    settings.compactList = compactList.checked; persistAll();
    document.body.classList.toggle('compact', settings.compactList);
  });
  haptics.addEventListener('change', ()=>{ settings.haptics = haptics.checked; persistAll(); });

  // ------- Seed / Reset -------
  seedDemo.addEventListener('click', ()=>{ seedDemoData(true); renderLists(); alert('Exemples ajoutés.'); });
  nukeAll.addEventListener('click', ()=>{
    if (confirm('Tout réinitialiser (flux + réglages) ?')){
      localStorage.clear();
      streams = []; settings = { autoResume:true, showLockInfo:true, tryHttp:false, compactList:false, haptics:true, useSSE:true };
      lastId = null;
      saveStreams();
      renderLists();
      clearForm();
      location.reload();
    }
  });

  function seedDemoData(force=false){
    if (streams.length && !force) return;
    const presets = [
      { name:'FIP hifi', url:'http://icecast.radiofrance.fr/fip-hifi.aac', format:'aac', favorite:true, notes:'Radio France' },
      { name:'FIP Rock', url:'http://icecast.radiofrance.fr/fiprock-midfi.mp3', format:'mp3', favorite:false, notes:'Thématique' },
      { name:'Radio Swiss Jazz', url:'https://stream.srg-ssr.ch/m/rsj/aacp_96', format:'aac', favorite:false, notes:'AAC 96k' }
    ];
    streams = presets.map(p=>({ id: cryptoRandom(), ...p }));
    persistAll();
  }

  // ------- Utilities -------
  function cryptoRandom(){
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Auto-resume last
  async function loadStreams(){
    try{
      const res = await fetch('/api/streams');
      streams = await res.json();
      if (!Array.isArray(streams)) streams = [];
      if (streams.length === 0){
        seedDemoData();
        await saveStreams();
      }
    }catch(err){
      console.error('Chargement des flux impossible', err);
    }
  }

  window.addEventListener('load', async ()=>{
    await loadStreams();
    renderLists();
    snapIndex();
    if (settings.autoResume && lastId){
      const cur = getCurrent();
      if (cur){
        nowName.textContent = cur.name;
        nowUrl.textContent = cur.url;
        audio.src = cur.url;
        playPause.disabled = false;
      }
    }
  });

  // Accessibilité: flèches pour changer de slide
  document.addEventListener('keydown', (e)=>{
    if (['ArrowLeft','ArrowRight'].includes(e.key)){
      const page = Math.round(slides.scrollLeft / slides.clientWidth);
      const target = e.key==='ArrowLeft' ? Math.max(0,page-1) : Math.min(2,page+1);
      slides.scrollTo({left: target*slides.clientWidth, behavior:'smooth'});
    }
  });

})();
