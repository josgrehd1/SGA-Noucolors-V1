import client from '../utils/client';

export const authApi = {
  login: (username, password, company_db) =>
    client.post('/auth/login', { username, password, company_db }),

  logout: () =>
    client.post('/auth/logout'),

  getSession: () =>
    client.get('/auth/session')
};

export default authApi;
