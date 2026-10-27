// Test urinishining sof (bazasiz) mantiqi: savollar tartibi va baholash.

export type LayoutItem = { q: string; o: string[] };
export type QuestionForLayout = { id: string; order: number; options: { id: string; order: number }[] };

export type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Urinish uchun savollar va variantlar tartibini tuzadi. */
export function buildLayout(
  questions: QuestionForLayout[],
  opts: { count: number; shuffleQuestions: boolean; shuffleOptions: boolean },
  rng: Rng = Math.random,
): LayoutItem[] {
  const byOrder = [...questions].sort((a, b) => a.order - b.order);
  // Savollar bankdan tasodifiy tanlanadi (bank testdagi savollar sonidan katta bo'lishi mumkin)
  const picked = byOrder.length > opts.count ? shuffle(byOrder, rng).slice(0, opts.count) : byOrder;
  const ordered = opts.shuffleQuestions ? shuffle(picked, rng) : picked.sort((a, b) => a.order - b.order);
  return ordered.map((q) => {
    const optIds = [...q.options].sort((a, b) => a.order - b.order).map((o) => o.id);
    return { q: q.id, o: opts.shuffleOptions ? shuffle(optIds, rng) : optIds };
  });
}

/** Javoblarni baholaydi. correct: savol ID -> to'g'ri variant ID. */
export function score(layout: LayoutItem[], answers: Map<string, string | null>, correct: Map<string, string>) {
  let correctCount = 0;
  const perQuestion = new Map<string, boolean>();
  for (const item of layout) {
    const ok = answers.get(item.q) != null && answers.get(item.q) === correct.get(item.q);
    perQuestion.set(item.q, ok);
    if (ok) correctCount++;
  }
  const totalCount = layout.length;
  const scorePct = totalCount ? Math.round((correctCount / totalCount) * 10000) / 100 : 0;
  return { correctCount, totalCount, scorePct, perQuestion };
}
