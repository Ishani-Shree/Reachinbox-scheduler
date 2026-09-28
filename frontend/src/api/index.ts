import type {
  CreateCampaignRequest,
  CreateCampaignResponse,
  EmailDetail,
  EmailFilter,
  EmailListResponse,
  EmailStats,
  EmailTab,
  Sender,
  SlackStatus,
  User,
} from '../types';
import { request } from './client';

export const GOOGLE_LOGIN_URL = '/api/auth/google';

export const authApi = {
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};

export const emailsApi = {
  list: (params: { tab: EmailTab; filter?: EmailFilter; q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams({
      tab: params.tab,
      filter: params.filter ?? 'all',
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 50),
    });
    if (params.q) qs.set('q', params.q);
    return request<EmailListResponse>(`/emails?${qs}`);
  },
  stats: () => request<EmailStats>('/emails/stats'),
  get: (id: string) => request<EmailDetail>(`/emails/${id}`),
};

export const attachmentUrl = (id: string) => `/api/attachments/${id}`;

export const campaignsApi = {
  create: (body: CreateCampaignRequest, idempotencyKey: string) =>
    request<CreateCampaignResponse>('/campaigns', {
      method: 'POST',
      json: body,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
};

export const sendersApi = {
  list: () => request<Sender[]>('/senders'),
};

export const slackApi = {
  status: () => request<SlackStatus>('/slack/status'),
  connectUrl: () => request<{ url: string }>('/slack/connect'),
  disconnect: () => request<void>('/slack', { method: 'DELETE' }),
  test: () => request<{ ok: boolean }>('/slack/test', { method: 'POST' }),
};
