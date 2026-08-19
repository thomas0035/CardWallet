/** Input validation for card entry. */

/** Strip the spaces users naturally type into a card number. */
export function normalizeCardNumber(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/**
 * Luhn checksum — the check digit every real payment card carries.
 *
 * The previous check was `cardNumber.length < 4` against the *unstripped*
 * string, so "   1" was accepted as a valid card number.
 */
export function isValidCardNumber(value: string): boolean {
  const digits = normalizeCardNumber(value);

  if (!/^\d+$/.test(digits)) return false;
  // 13 (older Visa) through 19 (some Maestro) covers every real card.
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48;

    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}

/**
 * Validate an MM/YY expiry and reject dates already past.
 *
 * Previously never validated at all — "99/99" and "00/00" were both stored.
 */
export function isValidExpiryDate(value: string, now: Date = new Date()): boolean {
  const match = value.trim().match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;

  const month = Number(match[1]);
  const year = Number(match[2]);

  if (month < 1 || month > 12) return false;

  // A card is valid through the end of its expiry month.
  const expiry = new Date(2000 + year, month, 1);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return expiry > startOfThisMonth;
}

/**
 * Whether a required text field actually has content.
 *
 * The old checks were plain falsy tests, so a field containing only spaces
 * counted as filled in.
 */
export function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}
