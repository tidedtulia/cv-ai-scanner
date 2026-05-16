export interface Position {
  id: string;
  title: string;
  requirements: string[];
}

export const POSITIONS: Position[] = [
  {
    id: 'frontend-dev',
    title: 'Frontend Developer',
    requirements: ['React / Next.js', 'TypeScript', 'Tailwind CSS'],
  },
  {
    id: 'backend-dev',
    title: 'Backend Developer',
    requirements: ['NestJS', 'PostgreSQL', 'Prisma ORM'],
  },
  {
    id: 'fullstack-dev',
    title: 'Fullstack Developer',
    requirements: ['React', 'NestJS', 'Docker'],
  },
];
