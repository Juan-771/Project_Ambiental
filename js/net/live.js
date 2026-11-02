let socket;

export function liveReady() {
  return Boolean(window.io);
}

export function connect() {
  if (!window.io) return null;
  if (!socket) socket = window.io();
  return socket;
}

function ask(event, payload) {
  const current = connect();
  return new Promise((resolve) => {
    if (!current) return resolve({ error: "El servidor multijugador no está disponible." });
    const timer = setTimeout(() => resolve({ error: "La sala no respondió. Revisa el código e inténtalo otra vez." }), 8000);
    current.emit(event, payload, (result) => {
      clearTimeout(timer);
      resolve(result || { error: "Respuesta vacía del servidor." });
    });
  });
}

export function joinPlayer(payload) {
  return ask("player:join", payload);
}

export function beginMission(mission) {
  return ask("mission:begin", { mission });
}

export function submitAnswer(itemKey, choice) {
  return ask("answer:submit", { itemKey, choice });
}

export function onRoom(handler) {
  connect()?.on("room:update", handler);
}

export async function publicRooms() {
  const response = await fetch("/api/rooms/public");
  if (!response.ok) return [];
  return response.json();
}
