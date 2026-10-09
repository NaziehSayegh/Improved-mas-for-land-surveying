// HTML helpers for the few places that build UI with innerHTML. File contents (project names,
// parcel numbers, headings, error messages...) must never be able to inject markup or handlers.

/** Escape text for use inside HTML text or a double/single-quoted attribute. */
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * For messages that mix our own simple formatting (<br>, <b>, <small>, <strong>) with data:
 * everything is escaped, then only those bare tags (no attributes) are switched back on.
 */
export const safeHtml = (message) =>
  escapeHtml(message)
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/&lt;(\/?)(b|small|strong)&gt;/gi, '<$1$2>');
