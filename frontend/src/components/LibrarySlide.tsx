export default function LibrarySlide() {
  return (
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
  );
}

