// Savollarni matndan ommaviy import qilish. Format (har savol bo'sh qator bilan ajratiladi):
//
//   1. Savol matni ($F = ma$ kabi formulalar mumkin)
//   A) variant
//   *B) to'g'ri variant (yulduzcha bilan belgilanadi)
//   C) variant
//   Izoh: yechim (ixtiyoriy)

export type ParsedQuestion = { text: string; explanation?: string; options: { text: string; isCorrect: boolean }[] };
export type ParseResult = { questions: ParsedQuestion[]; errors: string[] };

const OPTION_RE = /^(\*?)\s*([A-Fa-f]|[А-Еа-е])\s*[).]\s*(.+)$/;
const NUMBER_RE = /^\d+\s*[).]\s*/;
const EXPLAIN_RE = /^(izoh|yechim)\s*:\s*/i;

export function parseQuestions(input: string): ParseResult {
  const blocks = input.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];

  blocks.forEach((block, bi) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const textLines: string[] = [];
    const options: ParsedQuestion["options"] = [];
    let explanation: string | undefined;
    for (const line of lines) {
      const opt = line.match(OPTION_RE);
      if (EXPLAIN_RE.test(line)) explanation = line.replace(EXPLAIN_RE, "");
      else if (opt && textLines.length) options.push({ text: opt[3].trim(), isCorrect: opt[1] === "*" });
      else if (options.length === 0) textLines.push(line);
      else options[options.length - 1].text += `\n${line}`;
    }
    const n = bi + 1;
    const text = textLines.join("\n").replace(NUMBER_RE, "").trim();
    if (!text) return errors.push(`${n}-savol: matn yo'q`);
    if (options.length < 2) return errors.push(`${n}-savol: kamida 2 ta variant kerak (A), B) ...)`);
    const correct = options.filter((o) => o.isCorrect).length;
    if (correct !== 1) return errors.push(`${n}-savol: aynan bitta to'g'ri javobni * bilan belgilang (hozir ${correct} ta)`);
    questions.push({ text, explanation, options });
  });
  return { questions, errors };
}
