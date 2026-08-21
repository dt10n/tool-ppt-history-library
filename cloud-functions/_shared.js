function required(env, name) {
  const value = env?.[name] || process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

export async function supabaseRpc(env, functionName, body) {
  const baseUrl = required(env, "SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${functionName} failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function supabaseSelect(env, path) {
  const baseUrl = required(env, "SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) throw new Error(`Supabase select failed (${response.status})`);
  return response.json();
}

export { required };
