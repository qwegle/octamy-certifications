export function getOAuthParams(
  search: string,
  hash: string,
) {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const params = new URLSearchParams();

  // Successful callbacks must deliver bearer tokens in the fragment. Query
  // strings are sent to servers, logs, analytics, and referrers, so never
  // accept a token from one—even for backwards compatibility.
  const fragmentToken = fragment.get('token');
  if (fragmentToken) params.set('token', fragmentToken);
  const fragmentSuccess = fragment.get('success');
  if (fragmentSuccess) params.set('success', fragmentSuccess);

  // Failure redirects intentionally contain only a non-sensitive error code.
  const error = query.get('error') || fragment.get('error');
  if (error) params.set('error', error);
  return params;
}
