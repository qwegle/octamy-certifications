function downloadName(candidateId: number | string, contentType: string) {
  let extension = 'bin';
  if (contentType.includes('pdf')) extension = 'pdf';
  else if (contentType.includes('png')) extension = 'png';
  else if (contentType.includes('jpeg')) extension = 'jpg';
  else if (contentType.includes('wordprocessingml')) extension = 'docx';
  else if (contentType.includes('msword')) extension = 'doc';
  return `octamy-candidate-${candidateId}-cv.${extension}`;
}

/**
 * Download a protected candidate CV without putting the recruiter JWT in the
 * URL. A normal window.open navigation cannot attach the Authorization header.
 */
export async function downloadCandidateCv(url: string, candidateId: number | string) {
  const token = localStorage.getItem('recruiterToken');
  if (!token) throw new Error('Your recruiter session has expired. Sign in again.');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!response.ok) {
    const payload = await response.clone().json().catch(() => null);
    throw new Error(payload?.message || `CV download failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = downloadName(candidateId, blob.type || response.headers.get('content-type') || '');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}
