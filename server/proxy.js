const http = require('http');
const https = require('https');
const url = require('url');

const TARGET = process.env.TARGET || process.argv[2];
const PORT = process.env.PORT || 5000;

if (!TARGET) {
  console.error('Usage: TARGET=https://your-tunnel.loca.lt node proxy.js');
  console.error('Or: node proxy.js https://your-tunnel.loca.lt');
  process.exit(1);
}

const targetUrl = new URL(TARGET.endsWith('/') ? TARGET.slice(0, -1) : TARGET);

const server = http.createServer((req, res) => {
  try {
    const path = (targetUrl.pathname === '/' ? '' : targetUrl.pathname) + req.url;
    const options = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: path,
      headers: Object.assign({}, req.headers, {
        host: targetUrl.hostname,
        'bypass-tunnel-reminder': '1'
      })
    };

    const proxyReq = (targetUrl.protocol === 'https:' ? https : http).request(options, proxyRes => {
      // copy status and headers
      const headers = Object.assign({}, proxyRes.headers);
      // avoid sending back hop-by-hop headers that may confuse clients
      delete headers['transfer-encoding'];
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      console.error('Proxy request error:', err && err.message ? err.message : err);
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad gateway');
    });

    // pipe client body to target
    req.pipe(proxyReq);
  } catch (err) {
    console.error('Proxy error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error');
  }
});

server.listen(PORT, () => {
  console.log(`Reverse proxy listening on http://localhost:${PORT}`);
  console.log(`Forwarding to ${TARGET}`);
  console.log('Injecting header: bypass-tunnel-reminder: 1');
});
