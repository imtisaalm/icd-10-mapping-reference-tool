/**
 * Minimal CSV output helpers (RFC 4180 quoting). Pure functions with no
 * Node dependencies so they can run in the browser, where all file
 * generation happens — uploaded files never leave the user's machine.
 */

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** Converts an array of same-shaped objects to CSV using the given key order. */
export function objectsToCsv<T extends object>(keys: (keyof T & string)[], objects: T[]): string {
  return rowsToCsv(
    keys,
    objects.map((obj) => keys.map((k) => obj[k]))
  );
}
