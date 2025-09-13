import deezerLogo from '../assets/Logo_Deezer_2023.svg';

export default function PlayerSlide() {
  return (
    <section className="slide" aria-labelledby="player-title">
      <h1 id="player-title">Lecteur</h1>

      <div className="player-area">
        <div className="player-card card">
          <button id="toggleLog" className="log-badge" aria-label="Afficher le journal">journal</button>
          <div className="now-meta">
            <div className="title" id="nowName">Aucun flux</div>
            <div className="meta muted" id="nowMeta"></div>
          </div>

          <audio id="audio" preload="none" playsInline></audio>

          <div className="controls">
            <button id="playPause" className="btn primary" disabled aria-label="Lecture">▶︎</button>
          </div>
          <a id="deezerBtn" className="btn small deezer-cta" href="#" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir dans Deezer" hidden>
            <img src={deezerLogo} alt="Deezer" className="deezer-logo" />
          </a>
        </div>
        <div id="logBox" className="card log-box" hidden>
          <h2>Journal</h2>
          <div id="logEntries" className="log-entries"></div>
          <button id="copyLog" className="btn small">Copier</button>
        </div>
      </div>

      <div className="streams">
        <div className="card-head">
          <div className="row">
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
            <button id="addQuick" className="btn small">+ ajout rapide</button>
          </div>
        </div>
        <ul id="streamList" className="stream-list" aria-live="polite"></ul>
      </div>
    </section>
  );
}
