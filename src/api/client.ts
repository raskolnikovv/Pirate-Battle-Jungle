import axios from 'axios';
import { ensureMockWorkerReady } from '@/mocks/browser';

export const httpClient = axios.create({
  baseURL: '/api',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  responseType: 'json',
  transitional: { silentJSONParsing: false },
  timeout: 10000,
});

httpClient.interceptors.request.use(async (request) => {
  // Verify the mock transport before sending, especially before a one-shot POST.
  await ensureMockWorkerReady();
  return request;
});
