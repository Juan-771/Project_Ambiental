const KEY = "mpv-results";

export function saveResults(entry, progress) {
  const prev = loadResults();
  const best = !prev.best || entry.points > prev.best.points ? entry : prev.best;
  const payload = {
    last: entry,
    best,
    history: [entry, ...(prev.history || [])].slice(0, 8),
    progress: progress ?? prev.progress ?? null,
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
  return payload;
}

export function clearProgress() {
  const prev = loadResults();
  prev.progress = null;
  localStorage.setItem(KEY, JSON.stringify(prev));
}

export function loadResults() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { last: null, best: null, history: [] };
  } catch {
    return { last: null, best: null, history: [] };
  }
}
