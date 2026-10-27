import { describe, expect, it } from "vitest";
import { estimateRasch } from "../src/services/rasch.js";

describe("estimateRasch", () => {
  it("ko'p xato qilingan savolni qiyinroq deb baholaydi", () => {
    // 3 savol: 0 - oson, 1 - o'rta, 2 - qiyin
    const r: (0 | 1)[][] = [
      [1, 1, 0], [1, 0, 0], [1, 1, 1], [1, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 1], [1, 1, 0],
    ];
    const { difficulty } = estimateRasch(r);
    expect(difficulty[0]!).toBeLessThan(difficulty[1]!);
    expect(difficulty[1]!).toBeLessThan(difficulty[2]!);
  });

  it("hamma to'g'ri yechgan savol uchun baho chiqarmaydi", () => {
    const { difficulty } = estimateRasch([[1, 0], [1, 1], [1, 0]]);
    expect(difficulty[0]).toBeNull();
  });
});
