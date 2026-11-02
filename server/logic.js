import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { QUESTIONS, SITUATIONS, WASTE } from "../js/data/content.js";
import { POINTS } from "../js/core/scoring.js";

const SORT_KEYS = WASTE.map((item) => item.id);
const QUIZ_KEYS = QUESTIONS.map((item) => item.id);
const FINAL_KEYS = SITUATIONS.map((item) => item.id);
const MISSION_KEYS = { sort: SORT_KEYS, quiz: QUIZ_KEYS, final: FINAL_KEYS };
const SPEED = { sort: 90, quiz: 80, final: 45 };

const answers = new Map();
for (const item of WASTE) answers.set(item.id, { mission: "sort", ok: (choice) => choice === item.bin });
for (const item of QUESTIONS) answers.set(item.id, { mission: "quiz", ok: (choice) => Number(choice) === item.answer });
for (const item of SITUATIONS) answers.set(item.id, { mission: "final", ok: (choice) => Number(choice) === item.answer });

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken() {
  return randomBytes(24).toString("base64url");
}

export function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function passwordOk(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  return prev.length === next.length && timingSafeEqual(prev, next);
}

export function openDb(file) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      max_players INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL,
      auto_start INTEGER NOT NULL,
      rounds INTEGER NOT NULL,
      allow_late_join INTEGER NOT NULL,
      is_public INTEGER NOT NULL,
      is_open INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      starts_at TEXT
    );
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      nickname TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id),
      joined_at TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      score_at TEXT,
      connected INTEGER NOT NULL DEFAULT 1,
      missions_done INTEGER NOT NULL DEFAULT 0,
      finished INTEGER NOT NULL DEFAULT 0,
      UNIQUE(room_id, player_id)
    );
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY,
      participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      round_no INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      correct INTEGER NOT NULL,
      points INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(participant_id, round_no, item_key)
    );
    CREATE TABLE IF NOT EXISTS mission_marks (
      participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      round_no INTEGER NOT NULL,
      mission TEXT NOT NULL,
      started_at TEXT,
      closed INTEGER NOT NULL DEFAULT 0,
      seconds INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(participant_id, round_no, mission)
    );
  `);
  try { db.exec("ALTER TABLE rooms ADD COLUMN starts_at TEXT"); } catch { /* la columna ya existe */ }
  db.exec(`
    CREATE TABLE IF NOT EXISTS match_history (
      id INTEGER PRIMARY KEY,
      room_id INTEGER,
      room_code TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      snapshot TEXT NOT NULL
    );
  `);
  return db;
}

function now() {
  return new Date().toISOString();
}

function nextCode(db) {
  const row = db.prepare("SELECT code FROM rooms ORDER BY id DESC LIMIT 1").get();
  const n = row ? Number(row.code) + 1 : 1;
  return String(n).padStart(3, "0");
}

export function createRoom(db, input) {
  const code = nextCode(db);
  db.prepare(`INSERT INTO rooms
    (code, title, status, max_players, duration_sec, auto_start, rounds, allow_late_join, is_public, is_open, created_at)
    VALUES (?, ?, 'waiting', ?, ?, ?, ?, ?, ?, 1, ?)`).run(
    code,
    input.title || `Sala ${code}`,
    clamp(input.maxPlayers, 2, 40, 5),
    clamp(input.durationSec, 60, 3600, 900),
    input.autoStart ? 1 : 0,
    clamp(input.rounds, 1, 3, 1),
    input.allowLateJoin ? 1 : 0,
    input.isPublic ? 1 : 0,
    now()
  );
  return publicRoom(db, code);
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function publicRoom(db, code) {
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code) || code);
  if (!room) return null;
  return {
    ...shapeRoom(room),
    participants: listParticipants(db, room.id),
    leaderboard: leaderboard(db, room.id),
  };
}

export function normalizeCode(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-3).padStart(3, "0");
}

function shapeRoom(room) {
  const status = room.status === "ready" ? "waiting" : room.status;
  return {
    id: room.id,
    code: room.code,
    title: room.title,
    status,
    startsAt: room.starts_at || null,
    serverNow: Date.now(),
    maxPlayers: room.max_players,
    durationSec: room.duration_sec,
    autoStart: Boolean(room.auto_start),
    rounds: room.rounds,
    allowLateJoin: Boolean(room.allow_late_join),
    isPublic: Boolean(room.is_public),
    isOpen: Boolean(room.is_open),
    startedAt: room.started_at,
    finishedAt: room.finished_at,
  };
}

function listParticipants(db, roomId) {
  return db.prepare(`SELECT p.id, pl.nickname, pl.id AS playerId, p.score, p.score_at, p.connected, p.missions_done, p.finished, p.joined_at
    FROM participants p JOIN players pl ON pl.id = p.player_id
    WHERE p.room_id = ? ORDER BY p.joined_at`).all(roomId);
}

export function leaderboard(db, roomId) {
  const rows = db.prepare(`SELECT pl.nickname, pl.id AS playerId, p.score, p.score_at, p.missions_done, p.finished, p.joined_at,
      COALESCE((SELECT SUM(seconds) FROM mission_marks m WHERE m.participant_id = p.id), 0) AS seconds
    FROM participants p JOIN players pl ON pl.id = p.player_id
    WHERE p.room_id = ?
    ORDER BY p.score DESC, CASE WHEN p.score_at IS NULL THEN 1 ELSE 0 END, p.score_at ASC, p.joined_at ASC`).all(roomId);
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

export function listPublic(db) {
  return db.prepare(`SELECT code, title, status, max_players, is_open,
      (SELECT COUNT(*) FROM participants p WHERE p.room_id = rooms.id) AS players
    FROM rooms
    WHERE is_public = 1 AND is_open = 1 AND status != 'finished'`).all()
    .map((row) => ({
      code: row.code,
      title: row.title,
      status: row.status,
      maxPlayers: row.max_players,
      players: row.players,
      isOpen: Boolean(row.is_open),
    }));
}

export function joinRoom(db, { nickname, code, token }) {
  let name = String(nickname || "").trim().slice(0, 24);
  const codeKey = normalizeCode(code);
  if (!codeKey) return { error: "Escribe el código de la sala." };
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(codeKey);
  if (!room) return { error: "Esa sala no existe." };
  const status = room.status === "ready" ? "waiting" : room.status;
  if (!room.is_open || status === "closed") return { error: "La sala está cerrada." };
  if (status === "finished") return { error: "La partida ya finalizó." };
  if ((status === "countdown" || status === "playing") && !room.allow_late_join) {
    const already = token && db.prepare("SELECT p.id FROM participants p JOIN players pl ON pl.id = p.player_id WHERE p.room_id = ? AND pl.token_hash = ?").get(room.id, hashToken(token));
    if (!already) return { error: "La partida ya comenzó. Espera la siguiente." };
  }

  let player = token
    ? db.prepare("SELECT * FROM players WHERE token_hash = ?").get(hashToken(token))
    : null;
  let issued = token;
  if (!player && name.length < 2) return { error: "Escribe un nombre de al menos 2 letras." };
  if (player && name.length < 2) name = player.nickname;
  if (!player) {
    issued = newToken();
    const id = newToken();
    db.prepare("INSERT INTO players (id, token_hash, nickname, created_at) VALUES (?, ?, ?, ?)").run(id, hashToken(issued), name, now());
    player = db.prepare("SELECT * FROM players WHERE id = ?").get(id);
  } else if (player.nickname !== name) {
    db.prepare("UPDATE players SET nickname = ? WHERE id = ?").run(name, player.id);
    player.nickname = name;
  }

  const count = db.prepare("SELECT COUNT(*) AS n FROM participants WHERE room_id = ?").get(room.id).n;
  let member = db.prepare("SELECT * FROM participants WHERE room_id = ? AND player_id = ?").get(room.id, player.id);
  if (!member && count >= room.max_players) return { error: "La sala está llena." };
  if (!member) {
    db.prepare("INSERT INTO participants (room_id, player_id, joined_at) VALUES (?, ?, ?)").run(room.id, player.id, now());
    member = db.prepare("SELECT * FROM participants WHERE room_id = ? AND player_id = ?").get(room.id, player.id);
  }
  db.prepare("UPDATE participants SET connected = 1 WHERE id = ?").run(member.id);
  if (status === "ready") db.prepare("UPDATE rooms SET status = 'waiting' WHERE id = ?").run(room.id);
  return { token: issued, playerId: player.id, participantId: member.id, room: publicRoom(db, codeKey) };
}

function refreshStatus(db, roomId) {
  const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId);
  if (!room || room.status === "playing" || room.status === "finished") return;
  const count = db.prepare("SELECT COUNT(*) AS n FROM participants WHERE room_id = ?").get(roomId).n;
  const status = count >= 2 ? "ready" : "waiting";
  if (status !== room.status) db.prepare("UPDATE rooms SET status = ? WHERE id = ?").run(status, roomId);
}

export function setConnected(db, playerId, connected) {
  db.prepare("UPDATE participants SET connected = ? WHERE player_id = ?").run(connected ? 1 : 0, playerId);
}

export function startMatch(db, code) {
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code) || code);
  if (!room) return { error: "Sala no encontrada." };
  const status = room.status === "ready" ? "waiting" : room.status;
  if (!room.is_open || status === "closed") return { error: "La sala está cerrada." };
  if (status === "countdown" || status === "playing") return { error: "La partida ya fue iniciada." };
  if (status === "finished") return { error: "Reinicia la sala antes de empezar otra vez." };
  const count = db.prepare("SELECT COUNT(*) AS n FROM participants WHERE room_id = ?").get(room.id).n;
  if (!count) return { error: "No hay jugadores en la sala." };
  const startsAt = new Date(Date.now() + 5000).toISOString();
  db.prepare("UPDATE rooms SET status = 'countdown', starts_at = ?, started_at = NULL, finished_at = NULL WHERE id = ?").run(startsAt, room.id);
  return { room: publicRoom(db, code) };
}

export function cancelStart(db, code) {
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code) || code);
  if (!room) return { error: "Sala no encontrada." };
  if (room.status !== "countdown") return { error: "No hay una cuenta regresiva activa." };
  db.prepare("UPDATE rooms SET status = 'waiting', starts_at = NULL WHERE id = ?").run(room.id);
  return { room: publicRoom(db, code) };
}

export function promoteDue(db) {
  const due = db.prepare("SELECT code, starts_at FROM rooms WHERE status = 'countdown'").all();
  const changed = [];
  for (const room of due) {
    if (Date.parse(room.starts_at) > Date.now()) continue;
    db.prepare("UPDATE rooms SET status = 'playing', started_at = ?, starts_at = NULL WHERE code = ?").run(room.starts_at, room.code);
    changed.push(room.code);
  }
  return changed;
}

export function finishMatch(db, code) {
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code) || code);
  if (!room) return { error: "Sala no encontrada." };
  if (room.status === "finished") return { room: publicRoom(db, code) };
  db.prepare("UPDATE rooms SET status = 'finished', finished_at = ? WHERE id = ?").run(now(), room.id);
  const board = leaderboard(db, room.id);
  db.prepare("INSERT INTO match_history (room_id, room_code, finished_at, snapshot) VALUES (?, ?, ?, ?)").run(
    room.id, room.code, now(), JSON.stringify(board)
  );
  return { room: publicRoom(db, code), podium: board.slice(0, 3), leaderboard: board };
}

export function resetMatch(db, code) {
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code) || code);
  if (!room) return { error: "Sala no encontrada." };
  if (room.status === "playing" || room.status === "finished") {
    const board = leaderboard(db, room.id);
    if (room.status !== "finished") {
      db.prepare("INSERT INTO match_history (room_id, room_code, finished_at, snapshot) VALUES (?, ?, ?, ?)").run(
        room.id, room.code, now(), JSON.stringify(board)
      );
    }
  }
  const ids = db.prepare("SELECT id FROM participants WHERE room_id = ?").all(room.id).map((row) => row.id);
  for (const id of ids) {
    db.prepare("DELETE FROM answers WHERE participant_id = ?").run(id);
    db.prepare("DELETE FROM mission_marks WHERE participant_id = ?").run(id);
  }
  db.prepare("UPDATE participants SET score = 0, score_at = NULL, missions_done = 0, finished = 0 WHERE room_id = ?").run(room.id);
  db.prepare("UPDATE rooms SET status = 'waiting', started_at = NULL, finished_at = NULL WHERE id = ?").run(room.id);
  refreshStatus(db, room.id);
  return { room: publicRoom(db, code) };
}

export function updateRoom(db, code, input) {
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code) || code);
  if (!room) return { error: "Sala no encontrada." };
  db.prepare(`UPDATE rooms SET title = ?, max_players = ?, duration_sec = ?, auto_start = ?, rounds = ?, allow_late_join = ?, is_public = ?, is_open = ? WHERE id = ?`).run(
    input.title ?? room.title,
    input.maxPlayers != null ? clamp(input.maxPlayers, 2, 40, room.max_players) : room.max_players,
    input.durationSec != null ? clamp(input.durationSec, 60, 3600, room.duration_sec) : room.duration_sec,
    input.autoStart != null ? (input.autoStart ? 1 : 0) : room.auto_start,
    input.rounds != null ? clamp(input.rounds, 1, 3, room.rounds) : room.rounds,
    input.allowLateJoin != null ? (input.allowLateJoin ? 1 : 0) : room.allow_late_join,
    input.isPublic != null ? (input.isPublic ? 1 : 0) : room.is_public,
    input.isOpen != null ? (input.isOpen ? 1 : 0) : room.is_open,
    room.id
  );
  if (input.isOpen === false) db.prepare("UPDATE rooms SET status = 'closed' WHERE id = ? AND status IN ('waiting', 'ready')").run(room.id);
  if (input.isOpen === true) db.prepare("UPDATE rooms SET status = 'waiting' WHERE id = ? AND status = 'closed'").run(room.id);
  return { room: publicRoom(db, code) };
}

export function deleteRoom(db, code) {
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code) || code);
  if (!room) return { error: "Sala no encontrada." };
  db.prepare("DELETE FROM rooms WHERE id = ?").run(room.id);
  return { ok: true };
}

export function beginMission(db, { playerId, code, mission }) {
  if (!MISSION_KEYS[mission]) return { error: "Misión desconocida." };
  const found = memberOf(db, playerId, code);
  if (found.error) return found;
  if (found.room.status !== "playing") return { error: "La partida todavía no está en curso." };
  const round = currentRound(db, found.member.id);
  db.prepare(`INSERT INTO mission_marks (participant_id, round_no, mission, started_at, closed, seconds)
    VALUES (?, ?, ?, ?, 0, 0)
    ON CONFLICT(participant_id, round_no, mission) DO NOTHING`).run(found.member.id, round, mission, now());
  return { ok: true };
}

function memberOf(db, playerId, code) {
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code) || code);
  if (!room) return { error: "Sala no encontrada." };
  const member = db.prepare("SELECT * FROM participants WHERE room_id = ? AND player_id = ?").get(room.id, playerId);
  if (!member) return { error: "No estás en esta sala." };
  return { room, member };
}

function currentRound(db, participantId) {
  const row = db.prepare("SELECT COALESCE(MAX(round_no), 1) AS round FROM mission_marks WHERE participant_id = ?").get(participantId);
  return row.round || 1;
}

export function submitAnswer(db, { playerId, code, itemKey, choice }) {
  const found = memberOf(db, playerId, code);
  if (found.error) return found;
  if (found.room.status !== "playing") return { error: "La partida no acepta puntos en este momento." };
  const rule = answers.get(itemKey);
  if (!rule) return { error: "Esa actividad no existe." };
  const round = currentRound(db, found.member.id);
  const seen = db.prepare("SELECT id, points FROM answers WHERE participant_id = ? AND round_no = ? AND item_key = ?").get(found.member.id, round, itemKey);
  if (seen) {
    return { duplicate: true, ok: false, awarded: 0, score: found.member.score, leaderboard: leaderboard(db, found.room.id) };
  }
  const correct = rule.ok(choice);
  const awarded = correct ? POINTS.correct : 0;
  db.prepare("INSERT INTO answers (participant_id, round_no, item_key, correct, points, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    found.member.id, round, itemKey, correct ? 1 : 0, awarded, now()
  );
  if (awarded) {
    db.prepare("UPDATE participants SET score = score + ?, score_at = ? WHERE id = ?").run(awarded, now(), found.member.id);
  }
  const bonus = maybeCloseMission(db, found.member.id, round, rule.mission);
  const member = db.prepare("SELECT score FROM participants WHERE id = ?").get(found.member.id);
  return {
    ok: correct,
    duplicate: false,
    awarded: awarded + bonus,
    score: member.score,
    leaderboard: leaderboard(db, found.room.id),
  };
}

function maybeCloseMission(db, participantId, round, mission) {
  const keys = MISSION_KEYS[mission];
  const answered = db.prepare(`SELECT COUNT(*) AS n FROM answers WHERE participant_id = ? AND round_no = ? AND item_key IN (${keys.map(() => "?").join(",")})`).get(participantId, round, ...keys).n;
  if (answered < keys.length) return 0;
  const mark = db.prepare("SELECT * FROM mission_marks WHERE participant_id = ? AND round_no = ? AND mission = ?").get(participantId, round, mission);
  if (!mark || mark.closed) return 0;
  const seconds = mark.started_at ? Math.max(1, Math.round((Date.now() - Date.parse(mark.started_at)) / 1000)) : 999;
  let bonus = POINTS.mission;
  if (seconds <= SPEED[mission]) bonus += POINTS.speed;
  db.prepare("UPDATE mission_marks SET closed = 1, seconds = ? WHERE participant_id = ? AND round_no = ? AND mission = ?").run(seconds, participantId, round, mission);
  db.prepare("UPDATE participants SET score = score + ?, score_at = ?, missions_done = missions_done + 1 WHERE id = ?").run(bonus, now(), participantId);
  const done = db.prepare("SELECT missions_done FROM participants WHERE id = ?").get(participantId).missions_done;
  if (done >= 3) db.prepare("UPDATE participants SET finished = 1 WHERE id = ?").run(participantId);
  return bonus;
}

export function expireRoom(db, code) {
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code) || code);
  if (!room || room.status !== "playing" || !room.started_at) return null;
  if (Date.now() - Date.parse(room.started_at) < room.duration_sec * 1000) return null;
  return finishMatch(db, code);
}

export function dashboard(db) {
  const rooms = db.prepare("SELECT * FROM rooms ORDER BY id").all().map((room) => publicRoom(db, room.code));
  const players = db.prepare("SELECT COUNT(*) AS n FROM players").get().n;
  const connected = db.prepare("SELECT COUNT(*) AS n FROM participants WHERE connected = 1").get().n;
  const active = rooms.filter((room) => room.status === "playing" || room.status === "ready" || room.status === "waiting").length;
  const finished = db.prepare("SELECT COUNT(*) AS n FROM match_history").get().n;
  return { players, rooms: rooms.length, active, finished, connected, roomsDetail: rooms };
}

export function history(db) {
  return db.prepare("SELECT id, room_code, finished_at, snapshot FROM match_history ORDER BY id DESC LIMIT 30").all().map((row) => ({
    id: row.id,
    code: row.room_code,
    finishedAt: row.finished_at,
    board: JSON.parse(row.snapshot),
  }));
}

export function overview(db) {
  const rooms = db.prepare("SELECT * FROM rooms ORDER BY id").all();
  return rooms.map((room) => ({
    code: room.code,
    title: room.title,
    status: room.status,
    podium: leaderboard(db, room.id).slice(0, 3),
    leaderboard: leaderboard(db, room.id),
  }));
}
