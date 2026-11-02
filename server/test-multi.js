import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRoom,
  finishMatch,
  joinRoom,
  leaderboard,
  openDb,
  overview,
  promoteDue,
  startMatch,
  submitAnswer,
  beginMission,
} from "./logic.js";
import { WASTE } from "../js/data/content.js";

const db = openDb(join(mkdtempSync(join(tmpdir(), "mpv-")), "test.sqlite"));
const a = createRoom(db, { title: "Sala 001", maxPlayers: 5, isPublic: true, durationSec: 600 });
const b = createRoom(db, { title: "Sala 002", maxPlayers: 6, isPublic: false, durationSec: 600 });
if (a.code !== "001" || b.code !== "002") throw new Error("codes");

const namesA = ["Juan", "Carlos", "María", "Pedro", "Andrés"];
const namesB = ["Laura", "Daniela", "Miguel", "Santiago", "Camila"];
const roomA = namesA.map((nickname) => joinRoom(db, { nickname, code: "001" }));
const roomB = namesB.map((nickname) => joinRoom(db, { nickname, code: "002" }));
if (roomA.some((row) => row.error) || roomB.some((row) => row.error)) throw new Error("join");
const full = joinRoom(db, { nickname: "Extra", code: "001" });
if (!full.error) throw new Error("full room should reject");
const twin = joinRoom(db, { nickname: "Juan", code: "002" });
if (twin.error || !twin.playerId || twin.playerId === roomA[0].playerId) {
  throw new Error(`same name ${roomA[0].playerId} ${twin.playerId} ${twin.error || ""}`);
}

const started = startMatch(db, "001");
if (started.room.status !== "countdown") throw new Error("countdown");
const twice = startMatch(db, "001");
if (!twice.error) throw new Error("double start");
startMatch(db, "002");
db.prepare("UPDATE rooms SET starts_at = ?").run(new Date(Date.now() - 1000).toISOString());
promoteDue(db);
beginMission(db, { playerId: roomA[0].playerId, code: "001", mission: "sort" });
const first = WASTE[0];
const ok = submitAnswer(db, { playerId: roomA[0].playerId, code: "001", itemKey: first.id, choice: first.bin });
const again = submitAnswer(db, { playerId: roomA[0].playerId, code: "001", itemKey: first.id, choice: first.bin });
if (!ok.ok || ok.awarded < 10 || !again.duplicate) throw new Error("score once");
const leak = submitAnswer(db, { playerId: roomB[0].playerId, code: "002", itemKey: first.id, choice: "no-es" });
if (leak.ok) throw new Error("wrong answer scored");

const boardA = leaderboard(db, roomA[0].room.id);
const boardB = leaderboard(db, roomB[0].room.id);
if (boardA.length !== 5 || boardB.length !== 6) throw new Error(`sizes ${boardA.length} ${boardB.length}`);
if (boardA.some((row) => namesB.includes(row.nickname) && row.nickname !== "Juan")) throw new Error("rooms mixed");
if (boardB.find((row) => row.nickname === "Laura").score !== 0) throw new Error("room 2 changed");
if (boardA[0].nickname !== "Juan") throw new Error("rank");

finishMatch(db, "001");
const after = submitAnswer(db, { playerId: roomA[1].playerId, code: "001", itemKey: WASTE[1].id, choice: WASTE[1].bin });
if (!after.error) throw new Error("finished match still scores");
const view = overview(db);
if (view.length !== 2 || view[0].podium[0].nickname !== "Juan") throw new Error("admin overview");
if (view[0].leaderboard.length !== 5 || view[1].leaderboard.some((row) => row.playerId === roomA[0].playerId)) {
  throw new Error("overview mixed players");
}
console.log("escenarios 1, 2 y 3 ok");
