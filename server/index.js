import { readFileSync, existsSync } from "node:fs";
import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Server } from "socket.io";
import {
  beginMission,
  createRoom,
  dashboard,
  deleteRoom,
  expireRoom,
  cancelStart,
  finishMatch,
  history,
  joinRoom,
  loginPlayer,
  registerPlayer,
  listPublic,
  openDb,
  overview,
  passwordOk,
  publicRoom,
  promoteDue,
  resetMatch,
  setConnected,
  startMatch,
  submitAnswer,
  updateRoom,
  passwordHash,
} from "./logic.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const cut = line.indexOf("=");
    if (cut < 1 || line.startsWith("#")) continue;
    const key = line.slice(0, cut).trim();
    if (!process.env[key]) process.env[key] = line.slice(cut + 1).trim();
  }
}
const db = openDb(join(root, "server", "data", "mision.sqlite"));
const secret = process.env.SESSION_SECRET || randomBytes(24).toString("hex");
const adminName = (process.env.ADMIN_NAME || "administrador").trim().toLowerCase();
const adminRecord = passwordHash(process.env.ADMIN_PASSWORD || "cambia-esta-clave");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.path === "/.env" || req.path.startsWith("/server") || req.path.startsWith("/node_modules")) {
    return res.status(404).end();
  }
  next();
});
app.use(express.static(root, { index: "index.html", dotfiles: "deny" }));

function sign(value) {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function readCookie(req) {
  const raw = String(req.headers.cookie || "");
  const part = raw.split(";").map((item) => item.trim()).find((item) => item.startsWith("mpv_admin="));
  if (!part) return null;
  const token = decodeURIComponent(part.slice("mpv_admin=".length));
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  if (data.exp < Date.now()) return null;
  return data;
}

function requireAdmin(req, res, next) {
  if (!readCookie(req)) return res.status(401).json({ error: "No autorizado." });
  next();
}

app.post("/api/players/register", (req, res) => {
  const result = registerPlayer(db, { nickname: req.body?.name });
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

app.post("/api/players/login", (req, res) => {
  const result = loginPlayer(db, { nickname: req.body?.name });
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

app.post("/api/access", (req, res) => {
  const name = String(req.body?.name || "").trim().toLowerCase();
  if (name.length < 2) return res.status(400).json({ error: "Escribe un nombre de al menos 2 letras." });
  res.json({ role: name === adminName ? "admin" : "player" });
});

app.post("/api/admin/login", (req, res) => {
  if (!passwordOk(String(req.body?.password || ""), adminRecord)) {
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }
  const token = sign({ role: "admin", exp: Date.now() + 12 * 60 * 60 * 1000 });
  res.setHeader("Set-Cookie", `mpv_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`);
  res.json({ ok: true });
});

app.post("/api/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "mpv_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/rooms/public", (_req, res) => {
  res.json(listPublic(db));
});

app.use("/api/admin", requireAdmin);
app.get("/api/admin/dashboard", (_req, res) => res.json(dashboard(db)));
app.get("/api/admin/overview", (_req, res) => res.json(overview(db)));
app.get("/api/admin/history", (_req, res) => res.json(history(db)));
app.post("/api/admin/rooms", (req, res) => res.json(createRoom(db, req.body || {})));
app.patch("/api/admin/rooms/:code", (req, res) => {
  const result = updateRoom(db, req.params.code, req.body || {});
  if (result.error) return res.status(400).json(result);
  broadcast(result.room.code);
  res.json(result);
});
app.delete("/api/admin/rooms/:code", (req, res) => {
  const result = deleteRoom(db, req.params.code);
  io.to(`room:${req.params.code}`).emit("room:closed", { code: req.params.code });
  res.json(result);
});
app.post("/api/admin/rooms/:code/:action", (req, res) => {
  const actions = { start: startMatch, cancel: cancelStart, finish: finishMatch, reset: resetMatch, open: (database, code) => updateRoom(database, code, { isOpen: true }), close: (database, code) => updateRoom(database, code, { isOpen: false }) };
  const fn = actions[req.params.action];
  if (!fn) return res.status(404).json({ error: "Acción desconocida." });
  const result = fn(db, req.params.code);
  if (result.error) return res.status(400).json(result);
  broadcast(req.params.code);
  res.json(result);
});

const httpServer = createServer(app);
const io = new Server(httpServer);

function broadcast(code) {
  const room = publicRoom(db, code);
  if (!room) return;
  io.to(`room:${code}`).emit("room:update", room);
  io.to("admins").emit("admin:update", dashboard(db));
}

io.use((socket, next) => {
  const cookie = socket.handshake.headers.cookie || "";
  socket.data.admin = Boolean(readCookie({ headers: { cookie } }));
  next();
});

io.on("connection", (socket) => {
  if (socket.data.admin) socket.join("admins");

  socket.on("player:join", (payload, reply) => {
    const result = joinRoom(db, payload || {});
    if (result.error) return reply(result);
    socket.data.playerId = result.playerId;
    socket.data.code = result.room.code;
    socket.join(`room:${result.room.code}`);
    reply(result);
    broadcast(result.room.code);
  });

  socket.on("player:resume", ({ token, code }, reply) => {
    const result = joinRoom(db, { nickname: "·", code, token });
    if (result.error) return reply(result);
    socket.data.playerId = result.playerId;
    socket.data.code = code;
    socket.join(`room:${code}`);
    reply(result);
    broadcast(code);
  });

  socket.on("mission:begin", (payload, reply) => {
    const result = beginMission(db, { ...payload, playerId: socket.data.playerId, code: socket.data.code });
    reply(result);
  });

  socket.on("answer:submit", (payload, reply) => {
    const result = submitAnswer(db, { ...payload, playerId: socket.data.playerId, code: socket.data.code });
    reply(result);
    if (!result.error) broadcast(socket.data.code);
  });

  socket.on("disconnect", () => {
    if (!socket.data.playerId) return;
    setConnected(db, socket.data.playerId, false);
    if (socket.data.code) broadcast(socket.data.code);
  });
});

setInterval(() => {
  for (const code of promoteDue(db)) broadcast(code);
  const rooms = dashboard(db).roomsDetail;
  for (const room of rooms) {
    const ended = expireRoom(db, room.code);
    if (ended) broadcast(room.code);
  }
}, 250);

const port = Number(process.env.PORT || 8787);
httpServer.listen(port, () => {
  console.log(`Misión Planeta Verde en http://127.0.0.1:${port}`);
});
