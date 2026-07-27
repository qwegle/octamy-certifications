const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

export const env = Object.freeze({
  apiUrl: rawApiUrl ? normalizeOrigin(rawApiUrl) : undefined,
});

/** Call at the API boundary so design-system previews can run without network config. */
export function requireApiUrl(): string {
  if (!env.apiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is required before making Octamy API requests.');
  }

  return env.apiUrl;
}
