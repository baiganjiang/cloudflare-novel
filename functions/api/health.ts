export const onRequestGet = async () => {
  return new Response(JSON.stringify({ status: "ok", message: "Cloudflare Functions is working!" }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
