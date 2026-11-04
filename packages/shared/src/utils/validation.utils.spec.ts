import { isValidEmail } from './validation.utils';

describe('isValidEmail', () => {
  it.each(['jane@example.com', 'jane.doe+cv@sub.example.co', 'a@b.io'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'jane', 'jane@', '@example.com', 'jane@example', 'jane doe@example.com', 'jane@exa mple.com'])(
    'rejects %p',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );
});
