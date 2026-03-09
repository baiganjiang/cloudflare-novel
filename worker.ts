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
          })
        });

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          if (!response.ok) {
            let errorMessage = `API 请求失败 (${response.status})`;
            if (response.status === 524) {
              errorMessage = 'API 请求超时 (524)。这通常是因为 AI 模型生成内容的时间过长，超出了 Cloudflare 的限制。请尝试缩短生成内容的要求，或者使用响应更快的模型。';
            }
            return new Response(JSON.stringify({ error: errorMessage, details: responseText.substring(0, 200) }), {
              status: response.status,
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
          throw new Error(`无法解析 API 响应: ${responseText.substring(0, 100)}...`);
        }

        if (!response.ok) {
           return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        return new Response(JSON.stringify(data), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // 3. Handle /api/chat/gemini
    if (url.pathname === '/api/chat/gemini' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { model, contents, config } = body;
        
        const apiKey = env.GEMINI_API_KEY || body.key || '';
        
        const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          if (!response.ok) {
            let errorMessage = `API 请求失败 (${response.status})`;
            if (response.status === 524) {
              errorMessage = 'API 请求超时 (524)。这通常是因为 AI 模型生成内容的时间过长，超出了 Cloudflare 的限制。请尝试缩短生成内容的要求，或者使用响应更快的模型。';
            }
            return new Response(JSON.stringify({ error: errorMessage, details: responseText.substring(0, 200) }), {
              status: response.status,
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
          throw new Error(`无法解析 API 响应: ${responseText.substring(0, 100)}...`);
        }
        
        if (!response.ok) {
           return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 没有返回内容。";
        
        return new Response(JSON.stringify({ text }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // 4. Fallback to static assets (React app)
    // env.ASSETS is provided by Cloudflare Workers with Assets
    return env.ASSETS.fetch(request);
  }
};
