import { describe, expect, it } from "vitest";
import { buildLayout, score } from "../src/services/scoring.js";

const qs = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, order: i, options: [0, 1, 2, 3].map((j) => ({ id: `q${i}o${j}`, order: j })) }));

describe("buildLayout", () => {
  it("bankdan kerakli sondagi takrorlanmas savollarni tanlaydi", () => {
    const l = buildLayout(qs, { count: 20, shuffleQuestions: true, shuffleOptions: true });
    expect(l).toHaveLength(20);
    expect(new Set(l.map((x) => x.q)).size).toBe(20);
    for (const item of l) expect([...item.o].sort()).toEqual([0, 1, 2, 3].map((j) => `${item.q}o${j}`));
  });

  it("aralashtirish o'chiq bo'lsa tartib saqlanadi", () => {
    const l = buildLayout(qs.slice(0, 5), { count: 20, shuffleQuestions: false, shuffleOptions: false });
    expect(l.map((x) => x.q)).toEqual(["q0", "q1", "q2", "q3", "q4"]);
    expect(l[0].o).toEqual(["q0o0", "q0o1", "q0o2", "q0o3"]);
  });
});

describe("score", () => {
  it("to'g'ri javoblar va foizni hisoblaydi, javobsiz savol xato", () => {
    const layout = [{ q: "a", o: [] }, { q: "b", o: [] }, { q: "c", o: [] }, { q: "d", o: [] }];
    const r = score(layout, new Map([["a", "a1"], ["b", "x"], ["c", null]]), new Map([["a", "a1"], ["b", "b1"], ["c", "c1"], ["d", "d1"]]));
    expect(r.correctCount).toBe(1);
    expect(r.scorePct).toBe(25);
    expect(r.perQuestion.get("c")).toBe(false);
  });
});
