/**
 * Local dev seed: job categories, job levels, the 3 sample positions and the first HR account.
 *
 * Idempotent — rows that already exist (matched by `code` / `email`) are left untouched,
 * so re-running never overwrites what HR has edited.
 *
 * Run from packages/backend (Node >= 22):  npx prisma db seed
 */
import prismaClient from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hashPassword } from '../src/app/common/password.ts';

const { PrismaClient } = prismaClient;
type Prisma = InstanceType<typeof PrismaClient>;

const CATEGORIES = [
  { code: 'DEVELOPER', name: 'Developer', sortOrder: 10 },
  { code: 'QA', name: 'QA / Tester', sortOrder: 20 },
  { code: 'BA', name: 'Business Analyst', sortOrder: 30 },
  { code: 'DEVOPS', name: 'DevOps', sortOrder: 40 },
  { code: 'PM', name: 'Project Manager', sortOrder: 50 },
  { code: 'DESIGNER', name: 'Designer', sortOrder: 60 },
  { code: 'DATA', name: 'Data', sortOrder: 70 },
];

// Steps of 10 leave room to insert a level in between later
const LEVELS = [
  { code: 'INTERN', name: 'Intern', sortOrder: 10 },
  { code: 'FRESHER', name: 'Fresher', sortOrder: 20 },
  { code: 'JUNIOR', name: 'Junior', sortOrder: 30 },
  { code: 'MIDDLE', name: 'Middle', sortOrder: 40 },
  { code: 'SENIOR', name: 'Senior', sortOrder: 50 },
  { code: 'LEAD', name: 'Lead', sortOrder: 60 },
  { code: 'MANAGER', name: 'Manager', sortOrder: 70 },
];

// The 3 positions previously hardcoded in packages/frontend/src/data/positions.ts.
// Level / years are placeholders (Middle, 2 years) — HR adjusts them later.
const POSITIONS = [
  {
    code: 'frontend-dev',
    title: 'Frontend Developer',
    description: [
      '## About the role',
      'Build and maintain our web applications with React and Next.js.',
      '',
      '## Responsibilities',
      '- Implement UI features from designs',
      '- Write maintainable, tested TypeScript code',
      '- Work with backend developers on API contracts',
    ].join('\n'),
    criteria: [
      {
        name: 'React / Next.js',
        type: 'TECHNICAL',
        weight: 5,
        isRequired: true,
        description: 'Has shipped production features with React; Next.js (App Router) experience is a plus.',
      },
      {
        name: 'TypeScript',
        type: 'TECHNICAL',
        weight: 4,
        isRequired: true,
        description: 'Uses TypeScript in real projects: typed props/state, generics, strict mode.',
      },
      {
        name: 'Tailwind CSS',
        type: 'TECHNICAL',
        weight: 2,
        isRequired: false,
        description: 'Has built responsive layouts with Tailwind CSS or a similar utility-first framework.',
      },
    ],
  },
  {
    code: 'backend-dev',
    title: 'Backend Developer',
    description: [
      '## About the role',
      'Design and build the APIs behind our products with NestJS and PostgreSQL.',
      '',
      '## Responsibilities',
      '- Build and maintain REST APIs',
      '- Design database schemas and migrations',
      '- Write unit and integration tests',
    ].join('\n'),
    criteria: [
      {
        name: 'NestJS',
        type: 'TECHNICAL',
        weight: 5,
        isRequired: true,
        description: 'Has built production APIs with NestJS (modules, providers, guards) or a similar Node.js framework.',
      },
      {
        name: 'PostgreSQL',
        type: 'TECHNICAL',
        weight: 4,
        isRequired: true,
        description: 'Designs relational schemas, writes non-trivial SQL, understands indexes and transactions.',
      },
      {
        name: 'Prisma ORM',
        type: 'TECHNICAL',
        weight: 2,
        isRequired: false,
        description: 'Has used Prisma (schema, migrations, client) or another TypeScript ORM.',
      },
    ],
  },
  {
    code: 'fullstack-dev',
    title: 'Fullstack Developer',
    description: [
      '## About the role',
      'Own features end to end, from the React UI to the NestJS API and its deployment.',
      '',
      '## Responsibilities',
      '- Build features across frontend and backend',
      '- Containerize and deploy services',
      '- Review code and help keep the codebase healthy',
    ].join('\n'),
    criteria: [
      {
        name: 'React',
        type: 'TECHNICAL',
        weight: 4,
        isRequired: true,
        description: 'Has shipped production UI with React.',
      },
      {
        name: 'NestJS',
        type: 'TECHNICAL',
        weight: 4,
        isRequired: true,
        description: 'Has built production APIs with NestJS or a similar Node.js framework.',
      },
      {
        name: 'Docker',
        type: 'TECHNICAL',
        weight: 3,
        isRequired: false,
        description: 'Writes Dockerfiles and docker-compose setups for local dev or deployment.',
      },
    ],
  },
] as const;

async function seedCatalog(prisma: Prisma) {
  for (const category of CATEGORIES) {
    await prisma.jobCategory.upsert({ where: { code: category.code }, update: {}, create: category });
  }
  for (const level of LEVELS) {
    await prisma.jobLevel.upsert({ where: { code: level.code }, update: {}, create: level });
  }
}

async function seedPositions(prisma: Prisma) {
  const developer = await prisma.jobCategory.findUniqueOrThrow({ where: { code: 'DEVELOPER' } });
  const middle = await prisma.jobLevel.findUniqueOrThrow({ where: { code: 'MIDDLE' } });

  for (const { criteria, ...position } of POSITIONS) {
    const existing = await prisma.position.findUnique({ where: { code: position.code } });
    if (existing) continue;

    await prisma.position.create({
      data: {
        ...position,
        categoryId: developer.id,
        levelId: middle.id,
        minYearsExperience: 2,
        status: 'OPEN',
        criteria: { create: criteria.map((criterion, index) => ({ ...criterion, sortOrder: index })) },
      },
    });
  }
}

async function seedHrAccount(prisma: Prisma) {
  const email = process.env['SEED_HR_EMAIL']?.trim().toLowerCase();
  const password = process.env['SEED_HR_PASSWORD'];
  if (!email || !password) {
    console.warn('SEED_HR_EMAIL / SEED_HR_PASSWORD not set — skipping HR account');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  await prisma.user.create({
    data: {
      name: process.env['SEED_HR_NAME'] || 'HR Admin',
      email,
      passwordHash: await hashPassword(password),
    },
  });
}

/** A placeholder pasted from a guide (e.g. "<email hr>") must not become a real account */
function checkSeedHrEmail() {
  const email = process.env['SEED_HR_EMAIL']?.trim();
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    throw new Error('SEED_HR_EMAIL is not a valid email address (did you leave a placeholder such as <email> in the command?)');
  }
}

async function main() {
  checkSeedHrEmail();
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed the database');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString })) });
  try {
    await seedCatalog(prisma);
    // SEED_SAMPLE_DATA=false (production): categories, levels and the HR account only, no sample jobs
    if (process.env['SEED_SAMPLE_DATA']?.trim().toLowerCase() === 'false') console.log('SEED_SAMPLE_DATA=false — skipping the sample positions');
    else await seedPositions(prisma);
    await seedHrAccount(prisma);

    const [categories, levels, positions, criteria, users] = await Promise.all([
      prisma.jobCategory.count(),
      prisma.jobLevel.count(),
      prisma.position.count(),
      prisma.positionCriterion.count(),
      prisma.user.count(),
    ]);
    console.log(
      `Seed done — categories: ${categories}, levels: ${levels}, positions: ${positions}, criteria: ${criteria}, users: ${users}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // The message only: never the connection string or a stack with it (azure-deploy AC-6)
  console.error(`Seed failed: ${error instanceof Error ? error.message.split('\n').pop() : String(error)}`);
  process.exit(1);
});
