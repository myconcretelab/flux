const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const icy = require('icy');

const app = express();
const PORT = process.env.PORT || 3000;
const STREAM_FILE = './streams.json';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

async function fetchFallback(streamUrl) {
  try {
    const { origin } = new URL(streamUrl);

    // Icecast JSON status
    try {
      const res = await fetch(`${origin}/status-json.xsl`, {
        headers: { 'User-Agent': 'Node-ICY' }
      });
      const data = await res.json();
      const source = Array.isArray(data?.icestats?.source)
        ? data.icestats.source[0]
        : data?.icestats?.source;
      if (source?.title) {
        return { StreamTitle: source.title };
      }
    } catch {}

    // Generic "now playing" API
    try {
      const res = await fetch(`${origin}/nowplaying`, {
        headers: { 'User-Agent': 'Node-ICY' }
      });
      const data = await res.json();
      const title =
        data?.now_playing?.song?.text ||
        data?.now_playing?.song?.title ||
        data?.song ||
        data?.title;
      if (title) {
        return { StreamTitle: title };
      }
    } catch {}
  } catch {}

  return {};
}

async function readStreams() {
  try {
    const data = await fs.readFile(STREAM_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeStreams(list) {
  await fs.writeFile(STREAM_FILE, JSON.stringify(list, null, 2));
}

app.get('/api/streams', async (req, res) => {
  const streams = await readStreams();
  res.json(streams);
});

app.put('/api/streams', async (req, res) => {
  const streams = Array.isArray(req.body.streams) ? req.body.streams : [];
  await writeStreams(streams);
  res.json({ ok: true });
});

app.get('/api/metadata', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  let answered = false;
  const reply = data => {
    if (answered) return;
    answered = true;
    res.json(data);
  };

  const sendFallback = () => {
    fetchFallback(url).then(reply);
  };

  try {
    icy.get(
      url,
      { headers: { 'Icy-MetaData': '1', 'User-Agent': 'Node-ICY' } },
      icyRes => {
        icyRes.on('metadata', metadata => {
          const parsed = icy.parse(metadata);
          reply(parsed);
          icyRes.destroy();
        });
        icyRes.on('error', () => {
          icyRes.destroy();
          sendFallback();
        });
        setTimeout(() => {
          icyRes.destroy();
          sendFallback();
        }, 5000);
      }
    ).on('error', () => {
      sendFallback();
    });
  } catch (err) {
    sendFallback();
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
