export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    // 2. Handle /api/chat (OpenAI compatible)
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { url: apiUrl, key, model, messages, temperature, stream } = body;

        let fetchUrl = apiUrl.trim();
        if (!fetchUrl.endsWith('/chat/completions') && !fetchUrl.endsWith('/completions')) {
          fetchUrl = fetchUrl.replace(/\/+$/, '') + '/chat/completions';
        }

        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            stream
          })
        });

        // Proxy the response directly (supports streaming)
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 3. Handle /api/chat/gemini
    if (url.pathname === '/api/chat/gemini' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { model, contents, config, stream } = body;
        const apiKey = env.GEMINI_API_KEY || body.key || '';
        
        const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
        const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}?key=${apiKey}`;

        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: contents }] }],
            generationConfig: {
              temperature: config?.temperature,
            }
          })
        });

        // Proxy the response directly (supports streaming)
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 4. Fallback to static assets (React app)
    return env.ASSETS.fetch(request);
  }
};
