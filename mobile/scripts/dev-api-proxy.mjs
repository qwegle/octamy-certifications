import http from 'node:http';

const port = Number(process.env.DEV_API_PROXY_PORT || 8081);
const targetOrigin = 'https://octamy.com';
const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8082');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (!req.url?.startsWith('/api/') || !allowedMethods.has(req.method || '')) { res.writeHead(404).end(); return; }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_048_576) { res.writeHead(413).end(); return; }
    chunks.push(chunk);
  }
  try {
    const upstream = await fetch(`${targetOrigin}${req.url}`, {
      method: req.method,
      headers: {
        accept: req.headers.accept || 'application/json',
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
        ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}),
      },
      body: chunks.length ? Buffer.concat(chunks) : undefined,
      redirect: 'manual',
    });
    res.statusCode = upstream.status;
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'The Octamy API proxy could not reach octamy.com.' }));
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Octamy development API proxy: http://localhost:${port} -> ${targetOrigin}`);
});
