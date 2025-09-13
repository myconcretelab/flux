export default function SettingsSlide() {
  return (
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
  );
}

