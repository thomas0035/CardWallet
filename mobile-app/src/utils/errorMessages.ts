/**
 * Turns errors into something worth showing a human.
 *
 * The previous version of this app showed users raw internals: the backend
 * returned `JSON.stringify(error)` from its 500 handler, and RegisterScreen
 * rendered `String(error)` straight into an Alert. That leaked column and
 * constraint names into the UI while telling the user nothing useful.
 */

/** Network failures surface as a TypeError from fetch, with no useful message. */
function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /network request failed|failed to fetch|network error/i.test(message);
}

const AUTH_MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [/invalid login credentials/i, 'That email or password is not correct.'],
  [/email not confirmed/i, 'Check your inbox and confirm your email address first.'],
  [/user already registered|already been registered/i, 'An account with that email already exists. Try signing in.'],
  [/password should be at least (\d+)/i, 'Your password is too short — use at least $1 characters.'],
  [/unable to validate email|invalid email/i, "That email address doesn't look right."],
  [/for security purposes|rate limit|too many requests/i, 'Too many attempts. Wait a minute and try again.'],
  [/email address .* is invalid/i, "That email address doesn't look right."],
];

/** A readable message for a Supabase Auth failure. */
export function authErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Could not reach the server. Check your internet connection.';
  }

  const message = error instanceof Error ? error.message : String(error ?? '');

  for (const [pattern, friendly] of AUTH_MESSAGES) {
    const match = message.match(pattern);
    if (match) {
      // Substitute $1 so the server's own minimum length is reported, rather
      // than one hardcoded here that could drift out of sync with Supabase.
      return friendly.replace('$1', match[1] ?? '');
    }
  }

  return message || 'Something went wrong. Please try again.';
}

/** A readable message for a failed database read or write. */
export function dataErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Could not reach the server. Check your internet connection.';
  }

  const message = error instanceof Error ? error.message : String(error ?? '');

  // 42501 = insufficient_privilege. Under Row Level Security this means the
  // row is not yours, or the session expired. Either way "permission denied"
  // is not something a user can act on.
  if (/row-level security|42501|permission denied/i.test(message)) {
    return 'Your session has expired. Please sign in again.';
  }

  if (/jwt|token/i.test(message)) {
    return 'Your session has expired. Please sign in again.';
  }

  return message || 'Something went wrong. Please try again.';
}
