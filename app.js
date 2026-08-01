const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Load anime data
const animeDataPath = path.join(__dirname, 'data', 'anime.json');
let animeData = [];
function loadData() {
  try {
    const raw = fs.readFileSync(animeDataPath);
    animeData = JSON.parse(raw);
  } catch (err) {
    console.log('No anime data found, starting with empty database');
    animeData = [];
  }
}
function saveData() {
  fs.writeFileSync(animeDataPath, JSON.stringify(animeData, null, 2));
}
loadData();

// Helper: unique genre list for filters
function getAllGenres() {
  const set = new Set();
  animeData.forEach(a => (a.genre || []).forEach(g => set.add(g)));
  return [...set].sort();
}

// ---------- Public routes ----------

app.get('/', (req, res) => {
  const featured = animeData.slice(0, 6);
  res.render('index', {
    anime: animeData,
    featured,
    genres: getAllGenres(),
    activeGenre: '',
    searchQuery: '',
    title: 'Home - AnimeHub'
  });
});

app.get('/browse', (req, res) => {
  const genre = req.query.genre || '';
  const results = genre
    ? animeData.filter(a => (a.genre || []).includes(genre))
    : animeData;
  res.render('browse', {
    anime: results,
    genres: getAllGenres(),
    activeGenre: genre,
    title: 'Browse - AnimeHub'
  });
});

app.get('/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  const results = animeData.filter(a =>
    a.title.toLowerCase().includes(query) ||
    (a.genre || []).some(g => g.toLowerCase().includes(query))
  );
  res.render('index', {
    anime: results,
    featured: results.slice(0, 6),
    genres: getAllGenres(),
    activeGenre: '',
    searchQuery: query,
    title: `Search: ${query || 'All'} - AnimeHub`
  });
});

app.get('/anime/:id', (req, res) => {
  const anime = animeData.find(a => a.id === parseInt(req.params.id));
  if (!anime) return res.status(404).render('404', { title: 'Not Found' });
  res.render('anime', { anime, title: `${anime.title} - AnimeHub` });
});

app.get('/episode/:animeId/:epNum', (req, res) => {
  const anime = animeData.find(a => a.id === parseInt(req.params.animeId));
  if (!anime) return res.status(404).render('404', { title: 'Not Found' });

  const episode = anime.episodes.find(e => e.number === parseInt(req.params.epNum));
  if (!episode) return res.status(404).render('404', { title: 'Episode Not Found' });

  res.render('episode', {
    anime,
    episode,
    title: `Episode ${episode.number} - ${anime.title}`
  });
});

// ---------- Admin routes ----------

app.get('/admin', (req, res) => {
  res.render('admin', { anime: animeData, title: 'Admin Panel' });
});

app.post('/admin/add', (req, res) => {
  const nextId = animeData.length ? Math.max(...animeData.map(a => a.id)) + 1 : 1;
  const newAnime = {
    id: nextId,
    title: req.body.title,
    description: req.body.description,
    genre: req.body.genre.split(',').map(g => g.trim()).filter(Boolean),
    image: req.body.image || '/images/default.jpg',
    episodes: []
  };
  animeData.push(newAnime);
  saveData();
  res.redirect('/admin');
});

app.post('/admin/delete/:id', (req, res) => {
  animeData = animeData.filter(a => a.id !== parseInt(req.params.id));
  saveData();
  res.redirect('/admin');
});

app.post('/admin/add-episode', (req, res) => {
  const anime = animeData.find(a => a.id === parseInt(req.body.animeId));
  if (!anime) return res.status(404).send('Anime not found');

  const newEpisode = {
    number: parseInt(req.body.epNumber),
    title: req.body.epTitle || `Episode ${req.body.epNumber}`,
    // Official watch links only (streaming platforms), not file downloads
    watchLinks: {
      crunchyroll: req.body.crunchyroll || '',
      other: req.body.otherLink || ''
    }
  };
  anime.episodes.push(newEpisode);
  saveData();
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
