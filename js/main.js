import { BADGE_DEFS, BINS, LESSONS, MISSIONS, QUESTIONS, SITUATIONS, SOURCES, SUMMARIES, WASTE } from "./data/content.js";
import { closeMission, emptyAttempt, scoreOnce, totals } from "./core/scoring.js";
import { clearProgress, loadResults, saveResults } from "./core/storage.js";
import { appear, playTone, reactBin, setPlanet, soundOn, toggleSound, unlockBadges } from "./ui/fx.js";
import { beginMission, joinPlayer, liveReady, onRoom, publicRooms, submitAnswer } from "./net/live.js";

let finishToken = 0;

const state = {
  screen: "welcome",
  missions: { sort: null, quiz: null, final: null },
  current: null,
  attempt: null,
  startedAt: 0,
  timer: null,
  rushLeft: 0,
  rushId: null,
  locked: false,
  live: null,
  countTimer: null,
};

const $ = (sel) => document.querySelector(sel);
const screens = [...document.querySelectorAll(".screen")];

function show(name) {
  state.screen = name;
  screens.forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
  $("#topbar").hidden = name === "access";
  if (name === "welcome") paintContinue();
  const labels = { access: "Ingreso", lobby: "Sala", countdown: "Cuenta regresiva", podium: "Podio", admin: "Admin", missions: "Panel", brief: "Bitácora", lesson: "Aprende", game: "Juego", summary: "Resumen", sources: "Fuentes", results: "Resultados" };
  $("#hud-mission").textContent = labels[name] || "";
  paintHud();
  if (window.lucide) lucide.createIcons();
}

function sum() {
  return totals(state.missions);
}

function officialNow() {
  if (!state.live || state.live.offset == null) return Date.now();
  return Date.now() - state.live.offset;
}

function paintHud(clock = "—") {
  if (state.live?.room?.status === "playing" && state.live.room.startedAt) {
    const elapsed = Math.max(0, Math.floor((officialNow() - Date.parse(state.live.room.startedAt)) / 1000));
    clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  }
  const score = state.live ? state.live.score : sum().points + (state.attempt?.points || 0);
  $("#hud-score").textContent = String(score || 0);
  $("#hud-time").textContent = clock;
}

async function award(key, choice, localOk) {
  if (!state.live) {
    const scored = scoreOnce(state.attempt, key, localOk);
    return { ok: localOk, awarded: scored.awarded, duplicate: scored.duplicate };
  }
  if (state.attempt.seen.has(key)) return { duplicate: true, ok: false, awarded: 0 };
  const result = await submitAnswer(key, choice);
  if (result.error) return { ok: false, awarded: 0, duplicate: false, error: result.error };
  state.attempt.seen.add(key);
  state.attempt.total += 1;
  if (result.ok) {
    state.attempt.correct += 1;
    state.attempt.points += 10;
  }
  state.live.score = result.score;
  return result;
}

function clearClocks() {
  clearInterval(state.timer);
  clearInterval(state.rushId);
  state.timer = null;
  state.rushId = null;
  state.startedAt = 0;
}

function elapsedNow() {
  if (!state.startedAt) return 0;
  return Math.floor((Date.now() - state.startedAt) / 1000);
}

function startClock(onTick) {
  clearClocks();
  state.startedAt = Date.now();
  const tick = () => {
    const s = elapsedNow();
    const label = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    paintHud(label);
    if (onTick) onTick(s);
  };
  tick();
  state.timer = setInterval(tick, 250);
}

function feedback(text, ok) {
  const el = $("#feedback");
  el.textContent = text;
  el.className = `feedback ${ok ? "ok" : "no"}`;
  playTone(ok);
}

function earnedBadges() {
  const t = sum();
  const sort = state.missions.sort;
  const snapshot = {
    completed: Object.values(state.missions).filter(Boolean).length,
    done: {
      sort: Boolean(state.missions.sort),
      quiz: Boolean(state.missions.quiz),
      final: Boolean(state.missions.final),
    },
    sortAccuracy: sort && sort.total ? sort.correct / sort.total : 0,
    accuracy: t.accuracy,
  };
  return BADGE_DEFS.filter((b) => b.test(snapshot));
}

function progress() {
  const done = Object.values(state.missions).filter(Boolean).length;
  const pct = Math.round((done / MISSIONS.length) * 100);
  $("#done-count").textContent = `${done}/${MISSIONS.length}`;
  $("#progress-label").textContent = `${pct}%`;
  $("#progress-fill").style.width = `${pct}%`;
  $("#progress-bar").setAttribute("aria-valuenow", String(pct));
  const got = new Set(earnedBadges().map((b) => b.id));
  $("#badge-row").innerHTML = BADGE_DEFS.map((b) =>
    `<span class="badge ${got.has(b.id) ? "" : "off"}">${got.has(b.id) ? "✦" : "○"} ${b.label}</span>`
  ).join("");
}

function renderMissions() {
  const order = ["sort", "quiz", "final"];
  $("#mission-grid").innerHTML = MISSIONS.map((m) => {
    const index = order.indexOf(m.id);
    const prevOk = order.slice(0, index).every((id) => state.missions[id]);
    const locked = !prevOk;
    const status = state.missions[m.id] ? "Completada" : locked ? "Bloqueada" : "Disponible";
    return `
      <button class="glass mission-card" data-mission="${m.id}" ${locked ? "disabled" : ""}>
        <i data-lucide="${m.icon}"></i>
        <span class="tag">${status}</span>
        <h3>${m.title}</h3>
        <p>${m.text}</p>
      </button>`;
  }).join("");
  $("#mission-grid").querySelectorAll("[data-mission]").forEach((btn) => {
    btn.addEventListener("click", () => openMission(btn.dataset.mission));
  });
  progress();
  paintHud();
  setPlanet(Object.values(state.missions).filter(Boolean).length);
  if (window.lucide) lucide.createIcons();
  appear(document.querySelectorAll(".mission-card"));
}

function missionMeta(id) {
  return MISSIONS.find((m) => m.id === id);
}

function openMission(id) {
  finishToken += 1;
  clearClocks();
  state.current = id;
  state.attempt = null;
  state.locked = false;
  const lesson = LESSONS[id];
  $("#lesson-card").innerHTML = `
    <p class="eyebrow">Aprende primero</p>
    <h2>${lesson.title}</h2>
    <ul>${lesson.lines.map((line) => `<li>${line}</li>`).join("")}</ul>
    <p class="tip-box">${lesson.example}</p>
    <p class="tip-box"><strong>Consejo. </strong>${lesson.tip}</p>
    <p class="tip-box"><strong>Dato. </strong>${lesson.fact}</p>
    <button class="btn btn-primary" id="btn-learn-go" type="button">Empezar actividad</button>`;
  $("#btn-learn-go").addEventListener("click", () => beginActivity(id));
  $("#hud-mission").textContent = lesson.title;
  show("lesson");
  appear($("#lesson-card").children);
}

function beginActivity(id) {
  state.attempt = emptyAttempt();
  state.locked = false;
  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";
  const meta = missionMeta(id);
  $("#game-kicker").textContent = meta.title;
  $("#game-title").textContent = meta.title;
  $("#game-hint").textContent = meta.text;
  $("#hud-mission").textContent = meta.title;
  show("game");
  if (state.live) beginMission(id);
  if (id === "sort") mountSort();
  if (id === "quiz") mountQuiz();
  if (id === "final") mountFinal();
}

function finishMission(finishedAll) {
  if (state.locked) return;
  state.locked = true;
  const token = finishToken;
  const seconds = elapsedNow();
  clearClocks();
  const meta = missionMeta(state.current);
  const result = closeMission(state.attempt, seconds, meta.speedLimit, finishedAll);
  state.missions[state.current] = result;
  state.attempt = null;
  const note = [
    finishedAll ? `Bonus de misión +${result.missionBonus}.` : "Terminó el tiempo: sin bonus de misión.",
    result.speed ? " Bonus de rapidez +15." : "",
  ].join("");
  feedback(note, finishedAll);
  const stored = saveResults({
    points: sum().points,
    accuracy: Math.round(sum().accuracy * 100),
    seconds: sum().seconds,
    at: new Date().toISOString(),
    badges: earnedBadges().map((b) => b.id),
  }, state.missions);
  const all = MISSIONS.every((m) => state.missions[m.id]);
  setTimeout(() => {
    if (token !== finishToken) return;
    showSummary(stored, all);
  }, 700);
}

function showSummary(stored, all) {
  const id = state.current;
  const result = state.missions[id];
  $("#summary-card").innerHTML = `
    <p class="eyebrow">Lo que aprendiste</p>
    <h2>${missionMeta(id).title}</h2>
    <ul>${SUMMARIES[id].map((line) => `<li>${line}</li>`).join("")}</ul>
    <p class="tip-box">${result.correct} de ${result.total} aciertos. ${result.points} puntos en esta misión, con los bonus incluidos.</p>
    <p>${all ? "Completaste las tres misiones. El planeta se ve más sano." : "Cada misión limpia un poco más el planeta."}</p>
    <button class="btn btn-primary" id="btn-summary-next" type="button">${all ? "Ver resultados" : "Volver al panel"}</button>`;
  $("#btn-summary-next").addEventListener("click", () => {
    if (all) showResults(stored);
    else {
      show("missions");
      renderMissions();
    }
  });
  setPlanet(Object.values(state.missions).filter(Boolean).length);
  show("summary");
  appear($("#summary-card").children);
}

function binsHtml() {
  return `<div class="bins">${BINS.map((b) => `
    <div class="bin ${b.id}" data-bin="${b.id}">
      ${b.label}
      <small>${b.hint}</small>
    </div>`).join("")}</div>`;
}

function mountSort() {
  let pending = WASTE.map((item) => item.id);
  const draw = () => {
    const items = WASTE.filter((item) => pending.includes(item.id));
    $("#game-stage").innerHTML = `
      <p class="mission-progress">${WASTE.length - pending.length}/${WASTE.length} residuos</p>
      <div class="waste-row">${items.map((item) =>
        `<button class="waste" draggable="true" data-id="${item.id}" type="button">${item.name}</button>`
      ).join("")}</div>
      ${binsHtml()}`;
    document.querySelectorAll(".waste").forEach((el) => {
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", el.dataset.id);
        el.classList.add("is-selected");
      });
      el.addEventListener("click", () => {
        document.querySelectorAll(".waste").forEach((w) => w.classList.remove("is-selected"));
        el.classList.add("is-selected");
      });
    });
    document.querySelectorAll(".bin").forEach((bin) => {
      bin.addEventListener("dragover", (e) => {
        e.preventDefault();
        bin.classList.add("over");
      });
      bin.addEventListener("dragleave", () => bin.classList.remove("over"));
      const take = async (id) => {
        if (!id || !pending.includes(id) || state.locked) return;
        const item = WASTE.find((w) => w.id === id);
        const scored = await award(id, bin.dataset.bin, item.bin === bin.dataset.bin);
        if (scored.duplicate) return;
        if (scored.error) {
          feedback(scored.error, false);
          return;
        }
        const ok = scored.ok;
        pending = pending.filter((wasteId) => wasteId !== id);
        reactBin(bin, ok);
        const correctBin = BINS.find((b) => b.id === item.bin);
        feedback(
          ok ? `+${scored.awarded}. ${item.why}` : `${item.name} va al ${correctBin.label.toLowerCase()}: ${item.why}`,
          ok
        );
        paintHud();
        if (!pending.length) finishMission(true);
        else draw();
      };
      bin.addEventListener("drop", (e) => {
        e.preventDefault();
        bin.classList.remove("over");
        take(e.dataTransfer.getData("text/plain"));
      });
      bin.addEventListener("click", () => {
        const selected = document.querySelector(".waste.is-selected");
        if (selected) take(selected.dataset.id);
      });
    });
    appear(document.querySelectorAll(".waste, .bin"));
  };
  startClock();
  draw();
}

function mountQuiz() {
  let index = 0;
  const ask = () => {
    const q = QUESTIONS[index];
    $("#game-stage").innerHTML = `
      <p class="mission-progress">Pregunta ${index + 1} de ${QUESTIONS.length}</p>
      <div class="glass quiz-card">
        <h3>${q.q}</h3>
        <div class="quiz-list">
          ${q.options.map((op, i) => `<button class="quiz-opt" data-i="${i}" type="button">${op}</button>`).join("")}
        </div>
      </div>`;
    $("#game-stage").querySelectorAll(".quiz-opt").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (state.attempt.seen.has(q.id)) return;
        const scored = await award(q.id, btn.dataset.i, Number(btn.dataset.i) === q.answer);
        if (scored.error) {
          feedback(scored.error, false);
          return;
        }
        const ok = scored.ok;
        $("#game-stage").querySelectorAll(".quiz-opt").forEach((b, i) => {
          b.disabled = true;
          if (i === q.answer) b.classList.add("good");
          else if (b === btn && !ok) b.classList.add("bad");
        });
        feedback(ok ? `+${scored.awarded}. ${q.why}` : q.why, ok);
        paintHud();
        index += 1;
        setTimeout(() => {
          if (index >= QUESTIONS.length) finishMission(true);
          else ask();
        }, 1400);
      });
    });
  };
  startClock();
  ask();
}

function mountFinal() {
  let index = 0;
  state.rushLeft = missionMeta("final").speedLimit;
  const ask = () => {
    if (index >= SITUATIONS.length) {
      finishMission(true);
      return;
    }
    const q = SITUATIONS[index];
    $("#game-stage").innerHTML = `
      <p class="mission-progress">Situación ${index + 1} de ${SITUATIONS.length}</p>
      <div class="glass quiz-card">
        <h3>${q.q}</h3>
        <div class="quiz-list">
          ${q.options.map((op, i) => `<button class="quiz-opt" data-i="${i}" type="button">${op}</button>`).join("")}
        </div>
      </div>`;
    $("#game-stage").querySelectorAll(".quiz-opt").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (state.rushLeft <= 0 || state.attempt.seen.has(q.id)) return;
        const scored = await award(q.id, btn.dataset.i, Number(btn.dataset.i) === q.answer);
        if (scored.error) {
          feedback(scored.error, false);
          return;
        }
        const ok = scored.ok;
        $("#game-stage").querySelectorAll(".quiz-opt").forEach((b, i) => {
          b.disabled = true;
          if (i === q.answer) b.classList.add("good");
          else if (b === btn && !ok) b.classList.add("bad");
        });
        feedback(ok ? `+${scored.awarded}. ${q.why}` : q.why, ok);
        paintHud();
        index += 1;
        setTimeout(ask, 1200);
      });
    });
  };
  startClock(async (seconds) => {
    state.rushLeft = missionMeta("final").speedLimit - seconds;
    const left = Math.max(state.rushLeft, 0);
    paintHud(`0:${String(left).padStart(2, "0")}`);
    if (state.rushLeft <= 0 && !state.locked) {
      while (index < SITUATIONS.length) {
        await award(SITUATIONS[index].id, -1, false);
        index += 1;
      }
      feedback("Se acabó el tiempo. Las situaciones que faltaban no suman puntos.", false);
      finishMission(false);
    }
  });
  ask();
}

function formatTime(total) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function showResults(stored) {
  const t = sum();
  const acc = Math.round(t.accuracy * 100);
  const best = stored?.best?.points ?? loadResults().best?.points ?? t.points;
  $("#res-score").textContent = String(t.points);
  $("#res-acc").textContent = `${acc}%`;
  $("#res-time").textContent = formatTime(t.seconds);
  $("#result-title").textContent = acc >= 85 ? "¡Héroe ambiental!" : acc >= 60 ? "¡Buen trabajo!" : "Sigue practicando";
  $("#result-msg").textContent = `Precisión ${acc}%. Tu mejor puntuación guardada es ${best}.`;
  $("#result-cta").textContent = acc >= 60
    ? "Llamado a la acción: hoy separa en casa el blanco, el verde y el negro, y cuéntale a alguien por qué."
    : "Llamado a la acción: repasa los tres colores y practica de nuevo con una botella limpia, una cáscara y una servilleta sucia.";
  const got = new Set(earnedBadges().map((b) => b.id));
  $("#result-badges").innerHTML = BADGE_DEFS.map((b) =>
    `<span class="badge ${got.has(b.id) ? "" : "off"}">${got.has(b.id) ? "✦" : "○"} ${b.label}</span>`
  ).join("");
  show("results");
  unlockBadges($("#result-badges"));
}

function emptyMissions() {
  return { sort: null, quiz: null, final: null };
}

function restoreProgress() {
  const saved = loadResults().progress;
  state.missions = emptyMissions();
  if (!saved) return false;
  for (const id of ["sort", "quiz", "final"]) {
    if (saved[id]) state.missions[id] = saved[id];
  }
  return Object.values(state.missions).some(Boolean);
}

function resetRun() {
  clearClocks();
  clearProgress();
  state.missions = emptyMissions();
  state.attempt = null;
  state.current = null;
  state.locked = false;
  setPlanet(0);
  paintHud("—");
}

function paintContinue() {
  const saved = loadResults().progress;
  const has = saved && Object.values(saved).some(Boolean);
  $("#btn-continue").hidden = !has;
}

function paintSound() {
  const on = soundOn();
  const btn = $("#btn-sound");
  btn.setAttribute("aria-pressed", String(on));
  btn.setAttribute("aria-label", on ? "Silenciar sonidos" : "Activar sonidos");
  btn.innerHTML = `<i data-lucide="${on ? "volume-2" : "volume-x"}"></i>`;
  if (window.lucide) lucide.createIcons();
}

let sourceReturn = "welcome";

function showSources() {
  if (state.screen !== "sources") sourceReturn = state.screen;
  $("#source-list").innerHTML = SOURCES.map((source) =>
    `<li><a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a><br>${source.detail}</li>`
  ).join("");
  show("sources");
}

$("#btn-start").addEventListener("click", () => {
  resetRun();
  show("missions");
  renderMissions();
});
$("#btn-continue").addEventListener("click", () => {
  restoreProgress();
  show("missions");
  renderMissions();
});
$("#btn-bitacora").addEventListener("click", () => show("brief"));
$("#btn-brief-back").addEventListener("click", () => show("welcome"));
$("#btn-how").addEventListener("click", () => $("#how-dialog").showModal());
$("#btn-sources").addEventListener("click", showSources);
$("#btn-sources-end").addEventListener("click", showSources);
$("#btn-sources-back").addEventListener("click", () => show(sourceReturn));
$("#btn-sound").addEventListener("click", () => {
  toggleSound();
  paintSound();
});
function leaveToLogin() {
  clearClocks();
  clearInterval(state.countTimer);
  state.attempt = null;
  state.live = null;
  state.current = null;
  sessionStorage.removeItem("mpv-token");
  sessionStorage.removeItem("mpv-room");
  sessionStorage.removeItem("mpv-name");
  backToName();
  show("access");
}
$("#btn-home").addEventListener("click", leaveToLogin);
$("#btn-restart").addEventListener("click", () => {
  if (!state.current) return;
  finishToken += 1;
  clearClocks();
  beginActivity(state.current);
});
$("#btn-panel").addEventListener("click", () => {
  show("missions");
  renderMissions();
});
$("#btn-again").addEventListener("click", () => {
  resetRun();
  show("missions");
  renderMissions();
});

function renderLobby(room) {
  if (!state.live) return;
  state.live.room = room;
  state.live.offset = Date.now() - Number(room.serverNow || Date.now());
  const me = (room.leaderboard || []).find((row) => row.playerId === state.live.playerId);
  if (me) state.live.score = me.score;
  $("#lobby-code").textContent = `Código ${room.code}`;
  $("#lobby-title").textContent = room.title || `Sala ${room.code}`;
  $("#lobby-count").textContent = `Participantes: ${room.participants.length}/${room.maxPlayers}`;
  $("#lobby-status").textContent = room.status === "waiting"
    ? "¡Ya estás dentro! Espera a que el administrador inicie la misión."
    : "El administrador tiene el control de esta sala.";
  $("#lobby-list").innerHTML = room.participants.map((person) =>
    `<div class="person"><span><i class="${person.connected ? "online" : "offline"}"></i> ${person.nickname}</span><span>${person.connected ? "Conectado" : "Desconectado"}</span></div>`
  ).join("");
  paintHud();
  if (room.status === "finished") return showPodium(room);
  if (room.status === "countdown") return showCountdown(room);
  if (room.status === "playing") return enterLivePlay();
  clearInterval(state.countTimer);
  if (state.screen !== "lobby") show("lobby");
}

function showCountdown(room) {
  if (state.screen !== "countdown") show("countdown");
  clearInterval(state.countTimer);
  const tick = () => {
    const left = Math.ceil((Date.parse(room.startsAt) - officialNow()) / 1000);
    const el = $("#count-num");
    const next = left > 0 ? String(left) : "¡YA!";
    if (el.textContent !== next) {
      el.textContent = next;
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "pop 0.45s ease";
    }
  };
  tick();
  state.countTimer = setInterval(tick, 200);
}

function enterLivePlay() {
  clearInterval(state.countTimer);
  if (state.live.entered) return;
  state.live.entered = true;
  openMission("sort");
}

function showPodium(room) {
  const board = room.leaderboard || [];
  const medals = ["1.°", "2.°", "3.°"];
  $("#podium").innerHTML = board.slice(0, 3).map((row, index) =>
    `<article class="glass"><b>${medals[index]}</b><strong>${row.nickname}</strong><span>${row.score} pts</span><span>${row.seconds || 0}s · ${row.missions_done} retos</span></article>`
  ).join("") || "<p>Esta sala todavía no tiene podio.</p>";
  $("#room-board").innerHTML = board.map((row) =>
    `<div class="person"><span>${row.position}. ${row.nickname}</span><span>${row.score} pts · ${row.missions_done} retos</span></div>`
  ).join("");
  show("podium");
}

async function loadPublic() {
  const rooms = await publicRooms();
  $("#public-rooms").innerHTML = rooms.length ? rooms.map((room) =>
    `<button class="btn btn-glass" type="button" data-code="${room.code}">${room.code} · ${room.title} · ${room.players}/${room.maxPlayers}</button>`
  ).join("") : "<p>No hay salas públicas abiertas.</p>";
  $("#public-rooms").querySelectorAll("[data-code]").forEach((btn) => {
    btn.addEventListener("click", () => { $("#player-code").value = btn.dataset.code; });
  });
}

function backToName() {
  document.querySelector("#screen-access h1").textContent = "Escribe tu nombre";
  $("#name-form").hidden = false;
  $("#player-form").hidden = true;
  $("#admin-form").hidden = true;
}
$("#btn-back-name").addEventListener("click", backToName);
$("#btn-back-admin").addEventListener("click", backToName);
async function identifyName(name) {
  const response = await fetch("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const raw = await response.text();
  try { return JSON.parse(raw); } catch { return {}; }
}

function openPlayerArea(name) {
  localStorage.setItem("mpv-user", name.trim().toLowerCase());
  $("#hello-name").textContent = name;
  $("#name-form").hidden = true;
  $("#player-form").hidden = false;
  $("#admin-form").hidden = true;
  if (liveReady()) loadPublic();
  else $("#player-error").textContent = "Inicia el servidor con npm start para usar las salas.";
}

async function accountAction(path) {
  const name = $("#player-name").value.trim();
  if (name.length < 2) {
    $("#name-error").textContent = "Escribe un nombre de al menos 2 letras.";
    return;
  }
  let access = {};
  try {
    access = await identifyName(name);
  } catch {
    $("#name-error").textContent = "Esta página no tiene el servidor de usuarios.";
    return;
  }
  if (access.role === "admin") {
    $("#name-error").textContent = "";
    $("#hello-admin").textContent = name;
    document.querySelector("#screen-access h1").textContent = "Contraseña";
    $("#name-form").hidden = true;
    $("#admin-form").hidden = false;
    return;
  }
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {
    $("#name-error").textContent = "No se pudo conectar con el servidor.";
    return;
  }
  const raw = await response.text();
  let body = {};
  try { body = JSON.parse(raw); } catch { body = {}; }
  if (!response.ok) {
    $("#name-error").textContent = body.error || "No se pudo continuar.";
    return;
  }
  $("#name-error").textContent = "";
  sessionStorage.setItem("mpv-token", body.token);
  sessionStorage.setItem("mpv-name", body.nickname || name);
  openPlayerArea(body.nickname || name);
  if (body.room && body.room.status !== "closed" && body.room.status !== "finished") {
    sessionStorage.setItem("mpv-room", body.room.code);
    state.live = { token: body.token, playerId: body.playerId, score: 0, room: body.room, entered: false };
    renderLobby(body.room);
  }
}
$("#btn-register").addEventListener("click", () => accountAction("/api/players/register"));
$("#btn-login").addEventListener("click", () => accountAction("/api/players/login"));
$("#btn-mode-solo").addEventListener("click", () => {
  if (!localStorage.getItem("mpv-user")) {
    $("#name-error").textContent = "Regístrate o ingresa antes de practicar. Así tu progreso queda guardado.";
    return;
  }
  state.live = null;
  show("welcome");
});
$("#player-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = $("#player-code").value.trim();
  if (!code) {
    $("#player-error").textContent = "Escribe el código de la sala.";
    return;
  }
  const result = await joinPlayer({
    nickname: $("#player-name").value,
    code,
    token: sessionStorage.getItem("mpv-token") || "",
  });
  $("#player-error").textContent = result.error || "";
  if (result.error) return;
  sessionStorage.setItem("mpv-token", result.token);
  sessionStorage.setItem("mpv-room", result.room.code);
  sessionStorage.setItem("mpv-name", $("#player-name").value.trim());
  state.live = { token: result.token, playerId: result.playerId, score: 0, room: result.room, entered: false };
  renderLobby(result.room);
});
onRoom((room) => {
  if (!state.live || room.code !== state.live.room.code) return;
  renderLobby(room);
});

$("#admin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: $("#admin-pass").value }),
  });
  const body = await response.json();
  $("#admin-error").textContent = body.error || "";
  if (!response.ok) return;
  show("admin");
  loadAdmin();
});

async function adminApi(path, options) {
  const response = await fetch(path, options);
  if (response.status === 401) {
    show("access");
    return null;
  }
  return response.json();
}

async function loadAdmin() {
  const data = await adminApi("/api/admin/dashboard");
  const general = await adminApi("/api/admin/overview");
  if (!data || !general) return;
  $("#admin-stats").innerHTML = [
    ["Jugadores", data.players],
    ["Salas", data.rooms],
    ["Salas activas", data.active],
    ["Partidas finalizadas", data.finished],
    ["Conectados", data.connected],
  ].map(([label, value]) => `<article class="glass mission-card"><span class="tag">${label}</span><h3>${value}</h3></article>`).join("");
  $("#admin-rooms").innerHTML = data.roomsDetail.map((room) => `
    <article class="glass person" style="display:block;padding:12px">
      <strong>${room.code} · ${room.title}</strong>
      <p>${room.status} · ${room.participants.length}/${room.maxPlayers} · código ${room.code}</p>
      <div class="actions">
        <button class="btn btn-primary" data-act="start" data-code="${room.code}" type="button">Iniciar partida</button>
        <button class="btn btn-glass" data-act="cancel" data-code="${room.code}" type="button">Cancelar inicio</button>
        <button class="btn btn-glass" data-act="finish" data-code="${room.code}" type="button">Finalizar</button>
        <button class="btn btn-glass" data-act="reset" data-code="${room.code}" type="button">Reiniciar</button>
        <button class="btn btn-glass" data-act="close" data-code="${room.code}" type="button">Cerrar</button>
        <button class="btn btn-glass" data-act="open" data-code="${room.code}" type="button">Abrir</button>
        <button class="btn btn-glass" data-act="delete" data-code="${room.code}" type="button">Eliminar</button>
      </div>
      ${room.leaderboard.map((row) => `<div class="person"><span>${row.position}. ${row.nickname}</span><span>${row.score}</span></div>`).join("")}
    </article>`).join("");
  $("#admin-rooms").querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const code = btn.dataset.code;
      if (btn.dataset.act === "delete") await adminApi(`/api/admin/rooms/${code}`, { method: "DELETE" });
      else await adminApi(`/api/admin/rooms/${code}/${btn.dataset.act}`, { method: "POST" });
      loadAdmin();
    });
  });
  $("#admin-overview").innerHTML = general.map((room) => `
    <article class="glass" style="padding:12px;margin-top:10px">
      <strong>Sala ${room.code} · ${room.title} · ${room.status}</strong>
      ${(room.podium || []).map((row, index) => `<div class="person"><span>${index + 1}. ${row.nickname}</span><span>${row.score}</span></div>`).join("") || "<p>Sin puntajes</p>"}
    </article>`).join("");
}

$("#room-create").addEventListener("submit", async (event) => {
  event.preventDefault();
  await adminApi("/api/admin/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: $("#room-title").value,
      maxPlayers: Number($("#room-max").value),
      durationSec: Number($("#room-time").value) * 60,
      rounds: Number($("#room-rounds").value),
      isPublic: $("#room-public").checked,
      autoStart: $("#room-auto").checked,
      allowLateJoin: $("#room-late").checked,
    }),
  });
  loadAdmin();
});
$("#btn-admin-out").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  show("access");
});
if (liveReady()) {
  connectAdminFeed();
}
function connectAdminFeed() {
  onRoom(() => {
    if (state.screen === "admin") loadAdmin();
  });
}

const savedToken = sessionStorage.getItem("mpv-token");
const savedRoom = sessionStorage.getItem("mpv-room");
const savedName = sessionStorage.getItem("mpv-name");
if (savedToken && savedRoom && savedName && liveReady()) {
  joinPlayer({ nickname: savedName, code: savedRoom, token: savedToken }).then((result) => {
    if (result.error) return;
    state.live = { token: result.token, playerId: result.playerId, score: 0, room: result.room, entered: false };
    renderLobby(result.room);
  });
}

document.body.dataset.health = "0";
paintSound();
if (restoreProgress()) $("#btn-continue").hidden = false;
state.missions = emptyMissions();
show("access");
if (window.lucide) lucide.createIcons();
