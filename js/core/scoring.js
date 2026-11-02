export const POINTS = {
  correct: 10,
  mission: 20,
  speed: 15,
};

export function emptyAttempt() {
  return { points: 0, correct: 0, total: 0, seen: new Set() };
}

export function scoreOnce(attempt, key, ok) {
  if (attempt.seen.has(key)) return { awarded: 0, duplicate: true };
  attempt.seen.add(key);
  attempt.total += 1;
  if (ok) {
    attempt.correct += 1;
    attempt.points += POINTS.correct;
    return { awarded: POINTS.correct, duplicate: false };
  }
  return { awarded: 0, duplicate: false };
}

export function closeMission(attempt, seconds, speedLimit, finishedAll) {
  let bonus = 0;
  let speed = false;
  if (finishedAll) {
    bonus += POINTS.mission;
    if (seconds <= speedLimit) {
      bonus += POINTS.speed;
      speed = true;
    }
  }
  return {
    points: attempt.points + bonus,
    correct: attempt.correct,
    total: attempt.total,
    seconds,
    speed,
    missionBonus: finishedAll ? POINTS.mission : 0,
  };
}

export function totals(missions) {
  const list = Object.values(missions).filter(Boolean);
  const points = list.reduce((n, m) => n + m.points, 0);
  const correct = list.reduce((n, m) => n + m.correct, 0);
  const total = list.reduce((n, m) => n + m.total, 0);
  const seconds = list.reduce((n, m) => n + m.seconds, 0);
  return { points, correct, total, seconds, accuracy: total ? correct / total : 0 };
}
