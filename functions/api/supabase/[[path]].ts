export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);
  const targetHost = 'getofgqtvxcqhaprsrze.supabase.co';
  
  // Extract the path after /api/supabase
  const targetPath = url.pathname.replace(/^\/api\/supabase/, '');
  const targetUrl = `https://${targetHost}${targetPath}${url.search}`;

  // Clone the request to modify headers
  const request = new Request(targetUrl, context.request);
  request.headers.set('Host', targetHost);
  
  // We don't need to manually handle CORS because this function is hosted on the same domain as the frontend
  const response = await fetch(request);
  
  return response;
};
