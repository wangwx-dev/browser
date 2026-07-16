export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);
  const targetHost = 'getofgqtvxcqhaprsrze.supabase.co';
  
  // Extract the path after /api/supabase
  const targetPath = url.pathname.replace(/^\/api\/supabase/, '');
  const targetUrl = `https://${targetHost}${targetPath}${url.search}`;

  // Copy headers
  const newHeaders = new Headers(context.request.headers);
  newHeaders.delete('Host'); // Let the browser/fetch automatically set the correct Host
  newHeaders.delete('Origin'); // Remove Origin to avoid CORS issues at Supabase edge if they validate it
  newHeaders.delete('Referer');

  const init: RequestInit = {
    method: context.request.method,
    headers: newHeaders,
    redirect: 'manual'
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
  }

  const request = new Request(targetUrl, init);
  
  try {
    const response = await fetch(request);
    
    // Create a new response to allow us to modify headers (like CORS if needed, though same-origin shouldn't need it)
    const newResponse = new Response(response.body, response);
    return newResponse;
  } catch (err) {
    console.error("Proxy error:", err);
    return new Response("Proxy Error", { status: 502 });
  }
};
