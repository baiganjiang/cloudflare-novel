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
        const { url: apiUrl, key, model, messages, temperature } = body;

        let fetchUrl = apiUrl.trim();
        if (!fetchUrl.endsWith('/chat/completions') && !fetchUrl.endsWith('/completions')) {
          fetchUrl = fetchUrl.replace(/\/+$/, '') + '/chat/completions';
        }

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Send a keep-alive comment every 15 seconds to prevent Cloudflare's 100s timeout
        const keepAliveInterval = setInterval(() => {
          writer.write(encoder.encode(': keep-alive\n\n'));
        }, 15000);

        // Process fetch asynchronously
        (async () => {
          try {
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
                stream: true // Force streaming
              })
            });

            clearInterval(keepAliveInterval);

            if (!response.ok) {
              const errText = await response.text();
              writer.write(encoder.encode(`data: {"error": ${JSON.stringify(errText)}}\n\n`));
              writer.close();
              return;
            }

            if (response.body) {
              const reader = response.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                await writer.write(value);
              }
            }
            writer.close();
          } catch (err: any) {
            clearInterval(keepAliveInterval);
            writer.write(encoder.encode(`data: {"error": ${JSON.stringify(err.message)}}\n\n`));
            writer.close();
          }
        })();

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
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
        const { model, contents, config } = body;
        const apiKey = env.GEMINI_API_KEY || body.key || '';
        
        const action = 'streamGenerateContent?alt=sse';
        const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}?key=${apiKey}`;

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Send a keep-alive comment every 15 seconds to prevent Cloudflare's 100s timeout
        const keepAliveInterval = setInterval(() => {
          writer.write(encoder.encode(': keep-alive\n\n'));
        }, 15000);

        (async () => {
          try {
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

            clearInterval(keepAliveInterval);

            if (!response.ok) {
              const errText = await response.text();
              writer.write(encoder.encode(`data: {"error": ${JSON.stringify(errText)}}\n\n`));
              writer.close();
              return;
            }

            if (response.body) {
              const reader = response.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                await writer.write(value);
              }
            }
            writer.close();
          } catch (err: any) {
            clearInterval(keepAliveInterval);
            writer.write(encoder.encode(`data: {"error": ${JSON.stringify(err.message)}}\n\n`));
            writer.close();
          }
        })();

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
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
