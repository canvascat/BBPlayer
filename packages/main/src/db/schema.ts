export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  signature TEXT,
  source TEXT NOT NULL,
  remote_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CONSTRAINT source_integrity_check CHECK (
    (source = 'local' AND remote_id IS NULL)
    OR
    (source != 'local' AND remote_id IS NOT NULL)
  )
);
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unique_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
  cover_url TEXT,
  duration INTEGER,
  created_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS play_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  start_time INTEGER NOT NULL,
  duration_played INTEGER NOT NULL,
  completed INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
  description TEXT,
  cover_url TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  remote_sync_id INTEGER,
  last_synced_at INTEGER,
  share_id TEXT,
  share_role TEXT,
  last_share_sync_at INTEGER,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dynamic_playlist_sources (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  source_playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, source_playlist_id)
);
CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  sort_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);
CREATE TABLE IF NOT EXISTS bilibili_metadata (
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  bvid TEXT NOT NULL,
  cid INTEGER,
  is_multi_page INTEGER NOT NULL,
  main_track_title TEXT,
  video_is_valid INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS local_metadata (
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  local_path TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS playlist_sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  operation_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  hash TEXT NOT NULL,
  created_at NUMERIC
);
CREATE UNIQUE INDEX IF NOT EXISTS source_remote_id_unq ON artists (source, remote_id) WHERE source != 'local';
CREATE UNIQUE INDEX IF NOT EXISTS local_artist_unq ON artists (name) WHERE source = 'local';
CREATE INDEX IF NOT EXISTS artists_name_idx ON artists (name);
CREATE INDEX IF NOT EXISTS tracks_artist_idx ON tracks (artist_id);
CREATE INDEX IF NOT EXISTS tracks_title_idx ON tracks (title);
CREATE INDEX IF NOT EXISTS tracks_source_idx ON tracks (source);
CREATE INDEX IF NOT EXISTS play_history_track_idx ON play_history (track_id);
CREATE INDEX IF NOT EXISTS play_history_start_time_idx ON play_history (start_time);
CREATE INDEX IF NOT EXISTS playlists_title_idx ON playlists (title);
CREATE INDEX IF NOT EXISTS playlists_type_idx ON playlists (type);
CREATE INDEX IF NOT EXISTS playlists_author_idx ON playlists (author_id);
CREATE INDEX IF NOT EXISTS playlists_share_id_idx ON playlists (share_id);
CREATE INDEX IF NOT EXISTS dynamic_playlist_sources_playlist_idx ON dynamic_playlist_sources (playlist_id);
CREATE INDEX IF NOT EXISTS dynamic_playlist_sources_playlist_position_idx ON dynamic_playlist_sources (playlist_id, position);
CREATE INDEX IF NOT EXISTS dynamic_playlist_sources_source_idx ON dynamic_playlist_sources (source_playlist_id);
CREATE INDEX IF NOT EXISTS playlist_tracks_track_idx ON playlist_tracks (track_id);
CREATE INDEX IF NOT EXISTS playlist_tracks_sort_key_idx ON playlist_tracks (playlist_id, sort_key);
CREATE INDEX IF NOT EXISTS bilibili_metadata_bvid_cid_idx ON bilibili_metadata (bvid, cid);
CREATE INDEX IF NOT EXISTS playlist_sync_queue_status_idx ON playlist_sync_queue (status);
CREATE INDEX IF NOT EXISTS playlist_sync_queue_playlist_id_idx ON playlist_sync_queue (playlist_id);
`

/** 与 Android drizzle journal 的 `when` 对齐，导入后手机端只快进、不回放。 */
export const DRIZZLE_MIGRATION_TIMES = [
	1752671021496, 1752675517437, 1752730018660, 1752764634399, 1752765994431,
	1752841803161, 1754280698628, 1754301066604, 1754392244608, 1754567195657,
	1754922068529, 1759414938750, 1765119026759, 1771928969832, 1771933736787,
	1772029574604, 1772092756024, 1772169556066, 1774146549533, 1777691519059,
	1777696930773, 1781704505310,
]
