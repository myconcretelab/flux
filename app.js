/* StreamDeck Lite – v1.0.0 */
(() => {
  const VERSION = '1.0.0';
  const els = sel => document.querySelectorAll(sel);
  const $ = sel => document.querySelector(sel);

  // DOM refs
  const slides = $('#slides');
  const dots = [...$('#pager').children];
  const tabs = { player: $('#toPlayer'), lib: $('#toLibrary'), settings: $('#toSettings') };

  const audio = $('#audio');
  const nowName = $('#nowName');
  const nowUrl = $('#nowUrl');
  const playPause = $('#playPause');
  const stopBtn = $('#stopBtn');
  const volume = $('#volume');
  const autoResume = $('#autoResume');
  const showLockInfo = $('#showLockInfo');

  const streamList = $('#streamList');
  const addQuick = $('#addQuick');

  const form = $('#streamForm');
  const fId = $('#streamId');
  const fName = $('#streamName');
  const fUrl = $('#streamUrl');
  const fFmt = $('#streamFormat');
  const fFav = $('#streamFav');
  const fNotes = $('#streamNotes');
  const saveStream = $('#saveStream');
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
  const sleepStart = $('#sleepStart');
  const sleepLeft = $('#sleepLeft');

  // App state
  let streams = load('streams_v1', []);
  let settings = load('settings_v1', {
    autoResume: true,
    showLockInfo: true,
    tryHttp: false,
    compactList: false,
    haptics: true
  });
  let lastId = load('lastId_v1', null);
  let sleepTimer = null;
  let sleepETA = 0;

  appVersion.textContent = VERSION;

  // Apply settings UI
  autoResume.checked = !!settings.autoResume;
  showLockInfo.checked = !!settings.showLockInfo;
  tryHttp.checked = !!settings.tryHttp;
  compactList.checked = !!settings.compactList;
  haptics.checked = !!settings.haptics;
  document.body.classList.toggle('compact', settings.compactList);

  // Ensure demo data if empty
  if (streams.length === 0) {
    seedDemoData();
  }

  // ------- Storage helpers -------
  function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  function load(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{ return fallback; } }

  function persistAll(){
    save('streams_v1', streams);
    save('settings_v1', settings);
  }

  // ------- UI: slides / dots -------
  function snapIndex(){
    const idx = Math.round(slides.scrollLeft / slides.clientWidth);
    dots.forEach((d,i)=>d.classList.toggle('active', i===idx));
    tabs.player.classList.toggle('active', idx===0);
    tabs.lib.classList.toggle('active', idx===1);
    tabs.settings.classList.toggle('active', idx===2);
  }
  slides.addEventListener('scroll', () => { window.requestAnimationFrame(snapIndex); });
  tabs.player.addEventListener('click', ()=>slides.scrollTo({left:0, behavior:'smooth'}));
  tabs.lib.addEventListener('click', ()=>slides.scrollTo({left:slides.clientWidth, behavior:'smooth'}));
  tabs.settings.addEventListener('click', ()=>slides.scrollTo({left:slides.clientWidth*2, behavior:'smooth'}));

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
        li.className = 'item';
        li.innerHTML = `
          <div class="meta">
            <div class="name">${escapeHTML(s.name)} ${s.favorite?'<span class="badge">★</span>':''}</div>
            <div class="sub">${escapeHTML(s.url)}</div>
          </div>
          <div class="actions">
            <button class="play-btn" title="Lire">▶︎</button>
            <button class="open-btn" title="Ouvrir">${settings.tryHttp?'Safari':''}</button>
          </div>
        `;
        li.querySelector('.play-btn').addEventListener('click', ()=>{ selectAndPlay(s.id); });
        li.querySelector('.open-btn').addEventListener('click', ()=>{
          // ouvrir directement (utile si http bloqué)
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
    // rester sur place, mais réinitialiser le formulaire
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
    // préremplir avec FIP
    clearForm();
    fName.value = 'FIP hifi';
    fUrl.value = 'http://icecast.radiofrance.fr/fip-hifi.aac';
    fFmt.value = 'aac';
    fFav.checked = true;
    // basculer sur l’onglet gestion pour enregistrer/éditer
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
      // simple merge (évite doublons par nom+url)
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

  // ------- Audio / Playback -------
  volume.addEventListener('input', ()=> audio.volume = Number(volume.value));

  playPause.addEventListener('click', ()=>{
    if (audio.paused) audio.play().catch(showPlayError);
    else audio.pause();
  });
  stopBtn.addEventListener('click', ()=>{
    audio.pause();
    audio.currentTime = 0;
  });

  audio.addEventListener('play', ()=>{
    playPause.textContent = 'Pause';
    stopBtn.disabled = false;
    setMediaSession();
  });
  audio.addEventListener('pause', ()=>{
    playPause.textContent = 'Lecture';
    setMediaSession();
  });
  audio.addEventListener('ended', ()=>{ 
    playPause.textContent = 'Lecture';
    setMediaSession();
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
    alert(msg + extra);
  });

  function showPlayError(err){
    alert('Impossible de démarrer la lecture : ' + (err?.message || err));
  }

  function selectAndPlay(id){
    const s = streams.find(x=>x.id===id);
    if (!s) return;
    lastId = id; save('lastId_v1', lastId);
    nowName.textContent = s.name;
    nowUrl.textContent = s.url;

    let src = s.url;
    // Si param activé et url http (ou si https échoue, on proposera Safari)
    if (settings.tryHttp && /^https:\/\//i.test(src)){
      src = 'http:' + src.slice(6);
    }

    audio.src = src; // laisse le navigateur choisir le décodage
    playPause.disabled = false;
    stopBtn.disabled = false;

    // iOS requiert une interaction utilisateur préalable : ici le bouton déclenche
    audio.play().then(()=>{
      buzz();
      setMediaSession();
    }).catch(err=>{
      // si bloqué, proposer ouverture dans Safari
      if (/NotAllowedError|denied/i.test(err?.name || '')){
        alert('iOS a besoin d’une interaction. Appuyez à nouveau sur Lecture.');
      } else {
        alert('Erreur de lecture : ' + (err?.message || err));
      }
    });
  }

  function getCurrent(){ return streams.find(s=>s.id===lastId) || null; }

  // ------- Media Session (verrou/centre de contrôle) -------
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
  sleepStart.addEventListener('click', ()=>{
    const mins = Math.max(0, Number(sleepMinutes.value||0));
    if (sleepTimer){ clearInterval(sleepTimer); sleepTimer = null; }
    if (mins===0){
      sleepLeft.textContent = 'Minuteur désactivé.';
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
      streams = []; settings = { autoResume:true, showLockInfo:true, tryHttp:false, compactList:false, haptics:true };
      lastId = null; renderLists(); clearForm(); location.reload();
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
  window.addEventListener('load', ()=>{
    renderLists();
    snapIndex();
    if (settings.autoResume && lastId){
      // ne lance pas tout seul (iOS), mais prépare
      const cur = getCurrent();
      if (cur){
        nowName.textContent = cur.name;
        nowUrl.textContent = cur.url;
        audio.src = cur.url;
        playPause.disabled = false;
        stopBtn.disabled = false;
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
