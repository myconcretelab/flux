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

  try {
    icy.get(url, icyRes => {
      let answered = false;
      icyRes.on('metadata', metadata => {
        if (answered) return;
        answered = true;
        const parsed = icy.parse(metadata);
        res.json(parsed);
        icyRes.destroy();
      });
      icyRes.on('error', err => {
        if (answered) return;
        answered = true;
        res.status(500).json({ error: err.message });
      });
      setTimeout(() => {
        if (answered) return;
        answered = true;
        res.json({});
        icyRes.destroy();
      }, 5000);
    }).on('error', err => {
      res.status(500).json({ error: err.message });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
