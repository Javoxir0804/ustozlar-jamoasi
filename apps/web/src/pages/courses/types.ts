export type CourseCard = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPaid: boolean;
  subject: { id: string; name: string; slug: string };
  lessonCount: number;
  completedCount: number;
  hasAccess: boolean;
};
