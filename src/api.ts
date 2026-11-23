async function request(path: string, options: RequestInit) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw {
      message: data.error || 'Request failed',
      response: { data }
    };
  }

  return { data };
}

export const api = {
  async get(path: string) {
    return request(path, { method: 'GET' });
  },

  async post(path: string, body?: unknown) {
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {})
    });
  }
};