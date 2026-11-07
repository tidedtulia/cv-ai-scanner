import { createElement } from 'react';

/**
 * react-markdown is ESM-only and Jest runs CommonJS: render the raw markdown instead.
 * The real renderer is checked when the app runs.
 * Use with: jest.mock('react-markdown', () => require('<path>/test-utils/react-markdown.mock'));
 */
export default function ReactMarkdown({ children }: { children: string }) {
  return createElement('div', { 'data-testid': 'markdown' }, children);
}
