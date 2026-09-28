export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
}

export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed';
export type EmailTab = 'scheduled' | 'sent';
export type EmailFilter = 'all' | 'sent' | 'failed' | 'deferred';

export interface AttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface AttachmentUpload {
  filename: string;
  contentType: string;
  /** base64 */
  data: string;
}

export interface Email {
  id: string;
  campaignId: string;
  toEmail: string;
  subject: string;
  /** Sanitised HTML */
  body: string;
  /** Plain-text snippet for list rows */
  preview: string;
  status: EmailStatus;
  scheduledAt: string;
  originalScheduledAt: string;
  sentAt: string | null;
  previewUrl: string | null;
  error: string | null;
  deferredCount: number;
  sender: { name: string; email: string };
}

export interface EmailDetail extends Email {
  attachments: AttachmentMeta[];
}

export interface EmailListResponse {
  items: Email[];
  total: number;
  page: number;
  hasMore: boolean;
  source: 'elasticsearch' | 'postgres';
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
}

export interface CreateCampaignRequest {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startAt: string;
  delayBetweenSeconds: number;
  hourlyLimit: number;
  attachments: AttachmentUpload[];
}

export interface CreateCampaignResponse {
  id: string;
  totalRecipients: number;
  startAt: string;
  duplicate: boolean;
}

export interface SlackStatus {
  configured: boolean;
  connected: boolean;
  teamName: string | null;
  channelName: string | null;
}
