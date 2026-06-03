import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseBuffer } from 'music-metadata';
import yaml from 'js-yaml';

const MUSIC_DATA_PATH = path.resolve('src/data/music.json');
const CONFIG_PATH = path.resolve('ryuchan.config.yaml');
const CONCURRENCY = 8;
const RETRIES = 3;
const SAVE_INTERVAL = 20; // incremental save every N resolved
const SILENT = process.argv.includes('--silent');

const log = (...args) => { if (!SILENT) console.log(...args); };
const warn = (...args) => { console.warn(...args); };

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPlaylistSongs(playlistId, trans) {
  const apiUrl = `https://163.hyc.moe?server=netease&type=playlist&id=${playlistId}`;
  log(`  🎵 Fetching playlist ${playlistId}...`);
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Meting API failed: ${res.statusText}`);
    const data = await res.json();
    return data.map(item => {
      let songUrl = item.url?.replace(/http:\/\//g, 'https://');
      let lrcUrl = item.lrc?.replace(/http:\/\//g, 'https://');
      if (songUrl) songUrl += `&br=320`;
      if (trans && lrcUrl) lrcUrl += `&trans=true`;
      return {
        title: item.name,
        artist: item.artist || item.artist_name || 'Unknown',
        cover: item.pic?.replace(/http:\/\//g, 'https://'),
        url: songUrl,
        lrc: lrcUrl,
        duration: ""
      };
    });
  } catch (e) {
    console.error(`  ❌ Failed to fetch playlist ${playlistId}:`, e.message);
    return null;
  }
}

/**
 * Fetch duration for a single song with retries.
 * 1) Try Netease song detail API (fast, no bandwidth) for hyc.moe URLs.
 * 2) Fall back to buffer-parsing the actual audio stream.
 * Returns true on success, false after all retries exhausted.
 */
async function fetchDurationForSong(item) {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      // --- Path A: Netease API (hyc.moe URLs only) ---
      if (item.url && item.url.includes('163.hyc.moe')) {
        try {
          const parsedUrl = new URL(item.url);
          const id = parsedUrl.searchParams.get('id');
          if (id) {
            const res = await fetch(`https://music.163.com/api/song/detail/?id=${id}&ids=[${id}]`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.songs?.[0]?.duration) {
                item.duration = formatDuration(data.songs[0].duration / 1000);
                return true;
              }
            }
          }
        } catch (e) {
          // Netease API failed → fall through to buffer method below
        }
      }

      // --- Path B: buffer parsing ---
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(item.url, {
        headers: { 'Range': 'bytes=0-500000' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok || response.status === 206) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length < 1024) continue; // too small, retry
        const metadata = await parseBuffer(buffer, {
          mimeType: response.headers.get('content-type') || undefined
        });
        if (metadata?.format?.duration) {
          item.duration = formatDuration(metadata.format.duration);
          return true;
        }
      }
    } catch (e) {
      // retry on error (network timeout, etc.)
    }

    // backoff before retry
    if (attempt < RETRIES - 1) {
      await sleep(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
    }
  }

  return false;
}

/**
 * Compute a lightweight fingerprint from sorted unique URLs only.
 * Much faster than serializing full song objects.
 */
function computeUrlFingerprint(urls) {
  return crypto
    .createHash('sha256')
    .update([...urls].sort().join('\n'))
    .digest('hex');
}

/**
 * Compute config fingerprint to detect playlist config changes.
 * Only includes playlist IDs and types — no API calls needed.
 */
function computeConfigFingerprint(playlists) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(playlists.map(p => ({ id: p.id, type: p.type || 'netease' }))))
    .digest('hex');
}

async function fetchMusicDuration() {
  try {
    // --- Load config ---
    let config = {};
    try {
      const configStr = await fs.readFile(CONFIG_PATH, 'utf-8');
      config = yaml.load(configStr) || {};
    } catch (e) {
      log('Could not load config, using defaults');
    }

    const trans = config?.site?.meting?.trans !== false;
    const playlists = config?.music?.playlists || [];

    if (playlists.length === 0) {
      const singleId = config?.site?.meting?.id || '8900628861';
      playlists.push({ id: singleId, name: '默认歌单', server: 'netease' });
    }

    log(`🎵 ${playlists.length} playlist(s) configured`);

    // --- Load existing data (for cache & fingerprint) ---
    let existingData = { songs: [], playlistCounts: {}, playlistSongs: {} };
    const urlToDuration = new Map();
    let existingUrlFingerprint = null;
    let existingConfigFingerprint = null;

    try {
      const raw = await fs.readFile(MUSIC_DATA_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        existingData = { songs: parsed, playlistCounts: {}, playlistSongs: {} };
      } else {
        existingData = parsed;
      }
      existingData.songs.forEach(s => {
        if (s.url && s.duration) urlToDuration.set(s.url, s.duration);
      });
      existingUrlFingerprint = existingData._urlFingerprint || null;
      existingConfigFingerprint = existingData._configFingerprint || null;
    } catch (e) { /* no existing data */ }

    // --- Config fingerprint check (fast, no API calls) ---
    const configFingerprint = computeConfigFingerprint(playlists);

    // --- Fetch all playlists in parallel ---
    const playlistResults = await Promise.all(
      playlists.map(async (pl) => {
        let songs;
        if (pl.type === 'custom') {
          songs = existingData.playlistSongs?.[pl.id] || [];
          log(`  ✅ ${pl.name || pl.id} (自定义): ${songs.length} 首`);
        } else {
          let fetchedSongs = await fetchPlaylistSongs(pl.id, trans);
          if (fetchedSongs === null) {
            log(`  ⚠️ Failed to fetch, using cached for ${pl.name || pl.id}`);
            songs = existingData.playlistSongs?.[pl.id] || [];
          } else {
            songs = fetchedSongs;
          }
          log(`  ✅ ${pl.name || pl.id}: ${songs.length} 首`);
        }
        return { playlist: pl, songs };
      })
    );

    // --- Deduplicate & build data structures ---
    const playlistCounts = {};
    const playlistSongs = {};
    const allSongs = [];
    const seenUrls = new Set();
    const urlToSong = new Map();

    for (const { playlist, songs } of playlistResults) {
      playlistCounts[playlist.id] = songs.length;
      playlistSongs[playlist.id] = [];

      for (const song of songs) {
        if (!seenUrls.has(song.url)) {
          seenUrls.add(song.url);
          if (urlToDuration.has(song.url)) {
            song.duration = urlToDuration.get(song.url);
          }
          allSongs.push(song);
          urlToSong.set(song.url, song);
          playlistSongs[playlist.id].push(song);
        } else {
          playlistSongs[playlist.id].push(urlToSong.get(song.url));
        }
      }
    }

    // --- Lightweight URL fingerprint ---
    const urlFingerprint = computeUrlFingerprint(seenUrls);

    // --- Smart skip: config + URL set + playlist counts + all durations cached ---
    // playlistCounts catches: a playlist added/removed songs without URL change
    const playlistCountsChanged = JSON.stringify(playlistCounts) !== JSON.stringify(existingData.playlistCounts || {});
    if (
      configFingerprint === existingConfigFingerprint &&
      urlFingerprint === existingUrlFingerprint &&
      !playlistCountsChanged &&
      allSongs.every(s => !s.url || s.duration)
    ) {
      log('✅ Config, songs, and counts unchanged, all durations cached — skipping.');
      return;
    }

    log(`📊 Total unique songs: ${allSongs.length}`);

    // Collect songs that need duration fetching
    const pending = allSongs.filter(s => s.url && !s.duration);
    const alreadyCached = allSongs.length - pending.length;

    log(`📊 Cached durations: ${alreadyCached}`);
    log(`📊 Need durations: ${pending.length}`);

    if (pending.length === 0) {
      log('✅ All durations already cached.');
      const output = {
        songs: allSongs,
        playlistCounts,
        playlistSongs,
        _urlFingerprint: urlFingerprint,
        _configFingerprint: configFingerprint
      };
      await fs.writeFile(MUSIC_DATA_PATH, JSON.stringify(output, null, 4), 'utf-8');
      return;
    }

    // --- Concurrent duration fetching ---
    log(`🎵 Fetching ${pending.length} durations (${CONCURRENCY} concurrent, ${RETRIES} retries)...`);

    let index = 0;
    let success = 0;
    let failed = 0;
    let lastSave = 0;

    const output = {
      songs: allSongs,
      playlistCounts,
      playlistSongs,
      _urlFingerprint: urlFingerprint,
      _configFingerprint: configFingerprint
    };

    async function worker(workerId) {
      while (true) {
        const i = index;
        index++;
        if (i >= pending.length) break;

        const item = pending[i];
        const ok = await fetchDurationForSong(item);

        if (ok) {
          success++;
          const label = item.duration ? ` -> ${item.duration}` : ` -> ok`;
          log(`  [${workerId}]${label} (${success + failed}/${pending.length}) ${item.title}`);
        } else {
          failed++;
          warn(`  [${workerId}] -> FAILED (${success + failed}/${pending.length}) ${item.title}`);
        }

        // Incremental save
        if (success - lastSave >= SAVE_INTERVAL) {
          lastSave = success;
          try {
            await fs.writeFile(MUSIC_DATA_PATH, JSON.stringify(output, null, 4), 'utf-8');
            log(`  💾 Saved (${success} resolved so far)`);
          } catch (e) {
            console.error('  ⚠️  Save failed:', e.message);
          }
        }
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
    await Promise.all(workers);

    // Final save
    await fs.writeFile(MUSIC_DATA_PATH, JSON.stringify(output, null, 4), 'utf-8');

    log(`\n✅ Done. Resolved: ${success}, Failed: ${failed}, Total: ${allSongs.length}`);
    if (failed > 0) {
      log(`⚠️  ${failed} songs could not get durations. Re-run to retry.`);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

fetchMusicDuration();