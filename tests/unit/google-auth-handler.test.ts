import { describe, expect, it } from '@jest/globals';
import { getOAuthParams } from '../../client/src/utils/google-oauth-params';

describe('Google OAuth callback parameter handling', () => {
  it('accepts a successful bearer token from the URL fragment', () => {
    const params = getOAuthParams('', '#token=fragment-token&success=true');

    expect(params.get('token')).toBe('fragment-token');
    expect(params.get('success')).toBe('true');
  });

  it('rejects bearer tokens and success flags from the query string', () => {
    const params = getOAuthParams('?token=query-token&success=true', '');

    expect(params.get('token')).toBeNull();
    expect(params.get('success')).toBeNull();
  });

  it('prefers the fragment token and never reads a query token', () => {
    const params = getOAuthParams(
      '?token=query-token&success=true',
      '#token=fragment-token&success=true',
    );

    expect(params.get('token')).toBe('fragment-token');
  });

  it('retains non-sensitive OAuth failure codes from the query string', () => {
    const params = getOAuthParams('?error=invalid_oauth_state', '');

    expect(params.get('error')).toBe('invalid_oauth_state');
  });
});
