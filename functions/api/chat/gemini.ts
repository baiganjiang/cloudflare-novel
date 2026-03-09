export const onRequestOptions = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
};

export const onRequestPost = async (context) => {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { model, contents, config } = body;
    
    // Use env variable if available, otherwise use from body
    const apiKey = env.GEMINI_API_KEY || body.key;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: contents }] }],
        generationConfig: {
          temperature: config.temperature,
          // System instruction can be passed here if needed
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
    
    // Extract text from Gemini response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 没有返回内容。";
    
    return new Response(JSON.stringify({ text }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};
