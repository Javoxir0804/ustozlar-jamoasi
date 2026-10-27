// RASH (Rasch) modeli: savollar qiyinchiligini javoblar matritsasidan baholash.
// Oddiy JMLE (joint maximum likelihood) usuli; har kecha fon vazifasida ishga tushiriladi.

/** responses[p][i] = 1 (to'g'ri), 0 (xato), null (berilmagan). Natija: savol qiyinchiligi (logit). */
export function estimateRasch(responses: (0 | 1 | null)[][], iterations = 50): { difficulty: (number | null)[]; ability: (number | null)[] } {
  const P = responses.length;
  const I = P ? responses[0].length : 0;
  const ability = new Array<number>(P).fill(0);
  const difficulty = new Array<number>(I).fill(0);

  const rowScore = responses.map((r) => r.reduce<number>((s, x) => s + (x ?? 0), 0));
  const rowN = responses.map((r) => r.filter((x) => x !== null).length);
  const colScore = Array.from({ length: I }, (_, i) => responses.reduce((s, r) => s + (r[i] ?? 0), 0));
  const colN = Array.from({ length: I }, (_, i) => responses.filter((r) => r[i] !== null).length);

  // Hammasi to'g'ri yoki hammasi xato bo'lgan qatorlar/ustunlar uchun cheksiz baho chiqmasligi kerak
  const okP = rowScore.map((s, p) => s > 0 && s < rowN[p]);
  const okI = colScore.map((s, i) => s > 0 && s < colN[i]);
  const prob = (b: number, d: number) => 1 / (1 + Math.exp(d - b));

  for (let it = 0; it < iterations; it++) {
    for (let p = 0; p < P; p++) {
      if (!okP[p]) continue;
      let exp = 0, info = 0;
      for (let i = 0; i < I; i++) {
        if (responses[p][i] === null || !okI[i]) continue;
        const pr = prob(ability[p], difficulty[i]);
        exp += pr;
        info += pr * (1 - pr);
      }
      if (info > 0) ability[p] += Math.max(-1, Math.min(1, (rowScore[p] - exp) / info));
    }
    for (let i = 0; i < I; i++) {
      if (!okI[i]) continue;
      let exp = 0, info = 0;
      for (let p = 0; p < P; p++) {
        if (responses[p][i] === null || !okP[p]) continue;
        const pr = prob(ability[p], difficulty[i]);
        exp += pr;
        info += pr * (1 - pr);
      }
      if (info > 0) difficulty[i] -= Math.max(-1, Math.min(1, (colScore[i] - exp) / info));
    }
    // Shkalani markazlash: savollar qiyinchiligi o'rtachasi 0
    const valid = difficulty.filter((_, i) => okI[i]);
    const mean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    for (let i = 0; i < I; i++) if (okI[i]) difficulty[i] -= mean;
  }

  return {
    difficulty: difficulty.map((d, i) => (okI[i] ? Math.round(d * 1000) / 1000 : null)),
    ability: ability.map((a, p) => (okP[p] ? Math.round(a * 1000) / 1000 : null)),
  };
}
