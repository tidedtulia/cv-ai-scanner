import { APPLICATION_MESSAGES, type ApplicationMessageCode } from '@org/shared';

/**
 * English UI texts. Only the interface is bilingual — job content (title, JD, criteria,
 * category / level names) is shown as HR wrote it (IQ3).
 * `vi.ts` must have exactly the same shape: enforced by the `Dictionary` type and dictionaries.spec.ts.
 */
export const en = {
  meta: {
    siteName: 'CV AI Scanner',
    description: 'Browse open positions and submit your CV online.',
  },
  nav: {
    home: 'Home',
    jobs: 'Jobs',
    language: 'Language',
  },
  footer: {
    privacy: 'Privacy policy',
    aiNote: 'CVs are screened with the help of AI. Hiring decisions are always made by our HR team.',
  },
  common: {
    loadError: 'We could not load the data right now. Please try again in a moment.',
  },
  home: {
    title: 'Find your next role and apply in minutes',
    subtitle: 'Browse open positions, read the job description and submit your CV as a PDF — no account needed.',
    cta: 'View open jobs',
    stepsTitle: 'How to apply',
    steps: [
      {
        title: 'Pick a job',
        text: 'Filter open positions by category and level, then read the full job description.',
      },
      {
        title: 'Submit your CV',
        text: 'Enter your name and email and upload your CV as a PDF (max {maxMb}MB).',
      },
      {
        title: 'HR reviews it',
        text: 'An AI assistant scores your CV against the job criteria to help our HR team. A person always makes the final decision, and you get the result by email.',
      },
    ],
  },
  jobs: {
    title: 'Open jobs',
    subtitle: 'Positions we are hiring for right now.',
    category: 'Category',
    level: 'Level',
    allCategories: 'All categories',
    allLevels: 'All levels',
    clearFilters: 'Clear filters',
    experience: '{years}+ years of experience',
    noExperience: 'No experience required',
    criteria: 'Key requirements',
    apply: 'Apply',
    noMatch: 'No open jobs match these filters.',
    noJobs: 'There are no open jobs right now. Please check back later.',
  },
  submit: {
    title: 'Submit your CV',
    subtitle: 'Fill in your details and upload your CV to apply.',
    name: 'Name',
    namePlaceholder: 'Your full name',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    position: 'Position',
    positionPlaceholder: 'Select a position',
    cv: 'Upload CV',
    cvHint: 'PDF only, max {maxMb}MB',
    cvSelected: 'Selected: {name}',
    consentBefore: 'I agree that my personal data is processed as described in the ',
    consentLink: 'privacy policy',
    consentAfter: '.',
    submit: 'Submit CV',
    submitting: 'Submitting...',
    successText: 'We will review your application and get back to you by email.',
    backHome: 'Back to home',
    otherJobs: 'View other jobs',
    genericError: 'Failed to submit CV. Please try again.',
    jdLoading: 'Loading the job description...',
    jdError: 'Could not load the job description.',
    criteriaTitle: 'What we look for',
    noJobs: 'There are no open jobs to apply for right now.',
    viewJobs: 'View open jobs',
  },
  /** Same keys as the API's error `code` (APPLICATION_MESSAGES in @org/shared) */
  applicationMessages: APPLICATION_MESSAGES as Record<ApplicationMessageCode, string>,
  hr: {
    areaName: 'HR',
    loadError: 'We could not check your session right now. Please try again in a moment.',
    login: {
      title: 'HR sign in',
      heading: 'Sign in to the HR area',
      intro: 'For the recruiting team only.',
      email: 'Email',
      password: 'Password',
      submit: 'Sign in',
      submitting: 'Signing in…',
      sessionExpired: 'Your session has expired. Please sign in again.',
      errors: {
        emailRequired: 'Please enter your email',
        emailInvalid: 'Invalid email address',
        passwordRequired: 'Please enter your password',
        invalidCredentials: 'Incorrect email or password.',
        tooManyAttempts: 'Too many failed attempts. Please try again in {minutes} minutes.',
        network: 'Cannot reach the server. Please try again.',
      },
    },
    header: {
      signedInAs: 'Signed in as {name}',
      logout: 'Sign out',
      loggingOut: 'Signing out…',
    },
    home: {
      title: 'HR',
      greeting: 'Hello, {name}',
      intro: 'The applications and their AI evaluations will appear here.',
    },
  },
  privacy: {
    title: 'Privacy policy',
    updated: 'Last updated: {date}',
    intro: 'This policy explains how CV AI Scanner handles the personal data you send us when you apply for a job.',
    sections: [
      {
        heading: 'Data we collect',
        paragraphs: [
          'When you apply we collect your full name, your email address, the position you apply for and your CV (PDF file), including the information it contains.',
        ],
      },
      {
        heading: 'How we use it',
        paragraphs: [
          'We use this data only to assess your application for the position you chose and to contact you about the result.',
        ],
      },
      {
        heading: 'AI-assisted screening',
        paragraphs: [
          'Your CV is analysed by an AI model (Claude, by Anthropic) that scores it against the criteria of the position. The score only helps our HR team: every decision to accept or reject an application is made by a person.',
        ],
      },
      {
        heading: 'Where it is stored',
        paragraphs: [
          'CV files are stored in Google Drive and application data in our database. Only our HR team can access them. Our service providers — Google (storage) and Anthropic (AI analysis) — process the data only on our behalf and only for this purpose.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: ['We keep your application and CV for {months} months after you apply, then delete them.'],
      },
      {
        heading: 'Your rights',
        paragraphs: ['You can ask us to show, correct or delete your data, or withdraw your consent, by emailing {email}.'],
      },
      {
        heading: 'Your consent',
        paragraphs: [
          'By ticking the consent box on the application form you agree to the processing described on this page. Each application is handled separately.',
        ],
      },
    ],
  },
};

export type Dictionary = typeof en;
