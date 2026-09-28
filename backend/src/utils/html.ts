import sanitizeHtml from 'sanitize-html';

/** Tags produced by the compose editor (contentEditable + execCommand). */
const ALLOWED: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'div', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'ol', 'ul', 'li', 'blockquote', 'font', 'h1', 'h2', 'h3', 'a',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    font: ['size'],
    '*': ['style'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      'font-weight': [/^\w+$/],
      'font-style': [/^\w+$/],
      'text-decoration': [/^[\w\s-]+$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

const looksLikeHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Normalises an email body to safe HTML. Rich-text bodies from the editor are
 * sanitised; plain-text bodies (API clients, load test) are escaped and keep
 * their line breaks.
 */
export function toSafeHtml(body: string) {
  if (!looksLikeHtml(body)) return escapeHtml(body).replace(/\r?\n/g, '<br>');
  return sanitizeHtml(body, ALLOWED);
}

/** Plain-text version of an HTML body: used for the text/plain part, previews and search. */
export function toPlainText(html: string) {
  return sanitizeHtml(html.replace(/<(br|\/p|\/div|\/li|\/h\d|\/blockquote)\s*\/?>/gi, '\n'), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
