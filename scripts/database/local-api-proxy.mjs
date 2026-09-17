import http from 'node:http';

// Development-only routing for real local GoTrue and PostgREST. It does not
// fabricate users, tokens, database responses, uploads or realtime events.
const routes = [
  { prefix: '/auth/v1', port: 55440 },
  { prefix: '/rest/v1', port: 55441 },
];
http.createServer((request,response) => {
  const origin=request.headers.origin;
  if(origin && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
    response.setHeader('access-control-allow-origin',origin);
    response.setHeader('access-control-allow-headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,range,accept-profile,content-profile');
    response.setHeader('access-control-allow-methods','GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD');
    response.setHeader('access-control-expose-headers','content-range,range-unit,location');
  }
  if(request.method==='OPTIONS') {response.writeHead(204);response.end();return;}
  const route=routes.find(({prefix})=>request.url===prefix || request.url?.startsWith(prefix+'/'));
  if(!route) {response.writeHead(501,{'content-type':'application/json'});response.end('{"error":"This local stack only runs real Auth and PostgREST. Storage and Realtime services are not configured."}');return;}
  const upstream=http.request({hostname:'127.0.0.1',port:route.port,path:request.url.slice(route.prefix.length)||'/',method:request.method,
    headers:{...request.headers,host:`127.0.0.1:${route.port}`}},remote=>{
      for(const [name,value] of Object.entries(remote.headers)) if(value!==undefined && !name.startsWith('access-control-')) response.setHeader(name,value);
      response.writeHead(remote.statusCode??502);remote.pipe(response);
    });
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end('Local service unavailable');});
  request.pipe(upstream);
}).listen(55442,'127.0.0.1',()=>console.log('Local Auth/PostgREST gateway listening on loopback port55442'));
