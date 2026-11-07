import { LoginAttemptsService } from './login-attempts.service';

describe('LoginAttemptsService (hr-auth AC-4)', () => {
  const MIN = 60_000;
  const key = LoginAttemptsService.key('hr@example.com', '10.0.0.1');
  let attempts: LoginAttemptsService;
  beforeEach(() => (attempts = new LoginAttemptsService()));

  it('blocks for 15 minutes after 5 failures within 15 minutes', () => {
    for (let i = 0; i < 4; i++) attempts.recordFailure(key, i * MIN);
    expect(attempts.retryAfterSeconds(key, 4 * MIN)).toBe(0);
    attempts.recordFailure(key, 4 * MIN);
    expect(attempts.retryAfterSeconds(key, 4 * MIN)).toBe(15 * 60);
    expect(attempts.retryAfterSeconds(key, 4 * MIN + 14 * MIN)).toBe(60);
    expect(attempts.retryAfterSeconds(key, 4 * MIN + 15 * MIN)).toBe(0); // the block is over
  });

  it('only counts failures inside the 15-minute window', () => {
    for (let i = 0; i < 4; i++) attempts.recordFailure(key, i * MIN);
    attempts.recordFailure(key, 20 * MIN); // the first failures are older than 15 minutes
    expect(attempts.retryAfterSeconds(key, 20 * MIN)).toBe(0);
  });

  it('a successful login clears the counter', () => {
    for (let i = 0; i < 4; i++) attempts.recordFailure(key, i * MIN);
    attempts.reset(key);
    attempts.recordFailure(key, 5 * MIN);
    expect(attempts.retryAfterSeconds(key, 5 * MIN)).toBe(0);
  });

  it('another email or another IP is not affected', () => {
    for (let i = 0; i < 5; i++) attempts.recordFailure(key, 0);
    expect(attempts.retryAfterSeconds(key, 0)).toBeGreaterThan(0);
    expect(attempts.retryAfterSeconds(LoginAttemptsService.key('other@example.com', '10.0.0.1'), 0)).toBe(0);
    expect(attempts.retryAfterSeconds(LoginAttemptsService.key('hr@example.com', '10.0.0.2'), 0)).toBe(0);
  });
});
