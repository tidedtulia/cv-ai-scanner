import { Injectable } from '@nestjs/common';
import { LOGIN_BLOCK_SECONDS, LOGIN_FAILURE_WINDOW_SECONDS, LOGIN_MAX_FAILURES } from '@org/shared';

interface Attempts {
  /** Timestamps (ms) of the failures still inside the window */
  failures: number[];
  /** Until when (ms) logins are refused, once LOGIN_MAX_FAILURES is reached */
  blockedUntil?: number;
}

/**
 * Brute-force protection of POST /api/auth/login (AC-4): LOGIN_MAX_FAILURES wrong logins within the window
 * for the same email + IP block that pair for LOGIN_BLOCK_SECONDS. In memory: fine for one instance,
 * reset on restart (a shared store is needed with several instances on Azure).
 */
@Injectable()
export class LoginAttemptsService {
  private readonly attempts = new Map<string, Attempts>();

  static key(email: string, ip: string): string {
    return `${email}|${ip}`;
  }

  /** Seconds left while the key is blocked, 0 when it may try */
  retryAfterSeconds(key: string, now = Date.now()): number {
    const entry = this.attempts.get(key);
    if (!entry?.blockedUntil) return 0;
    if (entry.blockedUntil <= now) {
      this.attempts.delete(key);
      return 0;
    }
    return Math.ceil((entry.blockedUntil - now) / 1000);
  }

  recordFailure(key: string, now = Date.now()): void {
    this.prune(now);
    const entry = this.attempts.get(key) ?? { failures: [] };
    entry.failures = entry.failures.filter((t) => t > now - LOGIN_FAILURE_WINDOW_SECONDS * 1000);
    entry.failures.push(now);
    if (entry.failures.length >= LOGIN_MAX_FAILURES) {
      entry.blockedUntil = now + LOGIN_BLOCK_SECONDS * 1000;
      entry.failures = [];
    }
    this.attempts.set(key, entry);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  /** Drop stale entries so the map cannot grow without bound */
  private prune(now: number): void {
    if (this.attempts.size < 10_000) return;
    for (const [key, entry] of this.attempts) {
      const lastFailure = entry.failures[entry.failures.length - 1] ?? 0;
      if ((entry.blockedUntil ?? 0) <= now && lastFailure <= now - LOGIN_FAILURE_WINDOW_SECONDS * 1000) {
        this.attempts.delete(key);
      }
    }
  }
}
