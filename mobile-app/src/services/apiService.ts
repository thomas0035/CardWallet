import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://cardwallet-4shf.onrender.com';

const getToken = async () => {
  return await SecureStore.getItemAsync('token');
};

export const api = {
  post: async (endpoint: string, body: object, requiresAuth = false) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth) {
      const token = await getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    return response.json();
  },

  get: async (endpoint: string) => {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  },

  put: async (endpoint: string, body: object) => {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    return response.json();
  },

  delete: async (endpoint: string) => {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  },
};
