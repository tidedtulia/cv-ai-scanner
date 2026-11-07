/**
 * Stand-in for `src/lib/backend` (server-side API calls) in Jest.
 * Use with: jest.mock('<path>/lib/backend', () => require('<path>/test-utils/backend.mock'));
 */
import { CATEGORIES, LEVELS } from './fixtures';

export const fetchOpenPositions = jest.fn();
export const fetchJobCategories = jest.fn();
export const fetchJobLevels = jest.fn();

/** Default: the backend works, with no open job */
export function resetMockBackend() {
  fetchOpenPositions.mockReset().mockResolvedValue([]);
  fetchJobCategories.mockReset().mockResolvedValue(CATEGORIES);
  fetchJobLevels.mockReset().mockResolvedValue(LEVELS);
}

export function mockBackendUnavailable() {
  const down = () => Promise.reject(new Error('Backend positions responded 503'));
  fetchOpenPositions.mockImplementation(down);
  fetchJobCategories.mockImplementation(down);
  fetchJobLevels.mockImplementation(down);
}
