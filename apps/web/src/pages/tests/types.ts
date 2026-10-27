export type TestCard = {
  id: string;
  title: string;
  description: string | null;
  subject: { id: string; name: string };
  course: { id: string; title: string } | null;
  durationMin: number;
  questionCount: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  bestScore: number | null;
  opensAt: string | null;
  closesAt: string | null;
  requiresCode: boolean;
  locked: boolean;
  state: "OPEN" | "UPCOMING" | "CLOSED";
  openAttemptId: string | null;
};
