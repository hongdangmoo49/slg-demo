/**
 * API helper for REST endpoints
 */

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  if (options.token) {
    config.headers['Authorization'] = `Bearer ${options.token}`;
    delete config.token;
  }

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  register: (username, password) =>
    request('/auth/register', { method: 'POST', body: { username, password } }),

  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password } }),

  getRoles: (token) =>
    request('/auth/roles', { token }),

  selectRole: (token, roleId) =>
    request('/auth/selectRole', { method: 'POST', body: { roleId }, token }),

  getMapConfig: () =>
    request('/map/config'),

  health: () =>
    request('/health'),
};
