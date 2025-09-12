import { useEffect } from 'react'
import { initLegacyApp } from './legacyApp'

export default function App() {
  useEffect(() => {
    // Initialise la logique existante (événements, audio, SSE, etc.)
    const stop = initLegacyApp()
    return () => {
      // Nettoyages éventuels si nécessaire
      stop?.()
    }
  }, [])

  return (
    <>
      <header className="app-header">
        <div className="container">
          <div className="logo">
            <svg width="24" height="24" viewBox="0 0 128 128" aria-hidden="true">
              <rect rx="24" width="128" height="128" fill="#f4f6f8"></rect>
              <circle cx="64" cy="64" r="36" fill="var(--primary)"></circle>
              <path d="M82 64c0 9.94-8.06 18-18 18s-18-8.06-18-18 8.06-18 18-18 18 8.06 18 18z" fill="#fff" opacity=".9"></path>
            </svg>
            <span>StreamDeck</span>
          </div>
        </div>
      </header>

      <main id="slides" className="slides container" tabIndex={0} aria-label="Panneaux glissables">
        {/* Slide 1: Lecteur */}
        <section className="slide" aria-labelledby="player-title">
          <h1 id="player-title">Lecteur</h1>

          <div className="player-area">
            <div className="player-card card">
              <button id="toggleLog" className="log-badge" aria-label="Afficher le journal">journal</button>
              <div className="now-meta">
                <div className="title" id="nowName">Aucun flux</div>
                <div className="url" id="nowUrl">—</div>
                <div className="meta muted" id="nowMeta"></div>
              </div>

              <audio id="audio" preload="none" playsInline></audio>

              <div className="controls">
                <button id="playPause" className="btn primary" disabled aria-label="Lecture">▶︎</button>
              </div>

              <div className="extras">
                <div className="sleep">
                  <label htmlFor="sleepMinutes">Sleep</label>
                  <input id="sleepMinutes" type="range" min="0" max="90" step="5" defaultValue="0" list="sleepMarks" />
                  <datalist id="sleepMarks">
                    <option value="0"></option>
                    <option value="15"></option>
                    <option value="30"></option>
                    <option value="45"></option>
                    <option value="60"></option>
                    <option value="75"></option>
                    <option value="90"></option>
                  </datalist>
                  <span id="sleepLeft" className="muted"></span>
                </div>
              </div>
            </div>
            <div id="logBox" className="card log-box" hidden>
              <h2>Journal</h2>
              <div id="logEntries" className="log-entries"></div>
              <button id="copyLog" className="btn small">Copier</button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Vos flux</h2>
              <button id="addQuick" className="btn small">+ ajout rapide</button>
            </div>
            <ul id="streamList" className="stream-list" aria-live="polite"></ul>
          </div>
        </section>

        {/* Slide 2: Gestion des flux */}
        <section className="slide" aria-labelledby="library-title">
          <h1 id="library-title">Gestion des flux</h1>

          <div className="card">
            <form id="streamForm" className="grid">
              <input type="hidden" id="streamId" />
              <label>Nom
                <input id="streamName" type="text" placeholder="ex. FIP hifi" required />
              </label>
              <label>URL
                <div className="row url-row">
                  <input id="streamUrl" type="url" placeholder="http(s)://..." required />
                  <button type="button" id="pasteUrl" className="btn small">Coller</button>
                </div>
              </label>
              <label>Format (optionnel)
                <select id="streamFormat">
                  <option value="">Auto</option>
                  <option value="mp3">MP3</option>
                  <option value="aac">AAC</option>
                </select>
              </label>
              <label className="mui-switch"><input id="streamFav" type="checkbox" /> Favori</label>
              <label>Notes
                <input id="streamNotes" type="text" placeholder="bitrate, origine..." />
              </label>

              <div className="row">
                <button type="submit" className="btn primary" id="saveStream">Enregistrer</button>
                <button type="button" className="btn" id="resetForm">Nouveau</button>
                <button type="button" className="btn danger" id="deleteStream" disabled>Supprimer</button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Liste & organisation</h2>
              <div className="row">
                <button id="exportJson" className="btn small">Exporter JSON</button>
                <label className="btn small file-btn">Importer JSON
                  <input id="importJson" type="file" accept="application/json" hidden />
                </label>
              </div>
            </div>
            <ul id="manageList" className="manage-list"></ul>
          </div>
        </section>

        {/* Slide 3: Avancé */}
        <section className="slide" aria-labelledby="settings-title">
          <h1 id="settings-title">Options avancées</h1>

          <div className="card">
            <h2>Réseau & compatibilité iOS</h2>
            <label className="mui-switch"><input type="checkbox" id="tryHttp" /> Essayer le HTTP si HTTPS échoue</label>
            <p className="muted">
              Sur une page <strong>HTTPS</strong>, les flux <code>http://</code> sont bloqués par iOS.
              Servez cette appli en <strong>HTTP</strong> (réseau local) pour lire ces flux.
            </p>
          </div>

          <div className="card">
            <h2>Interface</h2>
            <label className="mui-switch"><input type="checkbox" id="compactList" /> Liste compacte</label>
            <label className="mui-switch"><input type="checkbox" id="haptics" /> Retour haptique (si dispo)</label>
            <label className="mui-switch"><input type="checkbox" id="autoResume" /> Reprendre automatiquement le dernier flux</label>
            <label className="mui-switch"><input type="checkbox" id="showLockInfo" /> Afficher titre sur l’écran verrouillé</label>
            <label>Couleur du lecteur
              <input id="playerBgColor" type="color" defaultValue="#f7f8fa" />
            </label>
          </div>

          <div className="card">
            <h2>Divers</h2>
            <button id="seedDemo" className="btn small">Insérer des exemples (FIP, etc.)</button>
            <button id="nukeAll" className="btn danger small">Tout réinitialiser</button>
            <p className="muted">Version <span id="appVersion"></span></p>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <div className="container">
          <nav className="pager" id="pager">
            <button id="toPlayer" aria-label="Lecteur" className="active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12l9-9 9 9"/>
                <path d="M9 21V9h6v12"/>
              </svg>
            </button>
            <button id="toLibrary" aria-label="Bibliothèque">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M3 10h18M10 4v18"/>
              </svg>
            </button>
            <button id="toSettings" aria-label="Réglages">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </nav>
        </div>
      </footer>
    </>
  )
}
