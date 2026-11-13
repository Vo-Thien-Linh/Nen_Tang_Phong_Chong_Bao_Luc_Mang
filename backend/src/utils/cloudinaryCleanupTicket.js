import { createHmac, timingSafeEqual } from 'node:crypto';

const uploadFolder = 'nexussocial_uploads/';
const ticketLifetimeMs = 15 * 60 * 1000;
const consumedTickets = new Map();

function publicIdFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !(url.hostname === 'cloudinary.com' || url.hostname.endsWith('.cloudinary.com'))) return null;
    const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    const uploadIndex = segments.indexOf('upload');
    const versionIndex = segments.findIndex((segment, index) => index > uploadIndex && /^v\d+$/.test(segment));
    if (uploadIndex === -1 || versionIndex === -1) return null;
    const publicIdWithExtension = segments.slice(versionIndex + 1).join('/');
    const lastSlash = publicIdWithExtension.lastIndexOf('/');
    const lastDot = publicIdWithExtension.lastIndexOf('.');
    const publicId = lastDot > lastSlash ? publicIdWithExtension.slice(0, lastDot) : publicIdWithExtension;
    return publicId.startsWith(uploadFolder) ? publicId : null;
  } catch {
    return null;
  }
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createCloudinaryCleanupTicket({ userId, publicId, secret = process.env.CLOUDINARY_API_SECRET || process.env.JWT_SECRET, now = Date.now() }) {
  if (!secret || !userId || typeof publicId !== 'string' || !publicId.startsWith(uploadFolder)) return null;
  const payload = Buffer.from(JSON.stringify({ userId: String(userId), publicId, expiresAt: now + ticketLifetimeMs })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyCloudinaryCleanupTicket({ ticket, userId, imageUrl, secret = process.env.CLOUDINARY_API_SECRET || process.env.JWT_SECRET, now = Date.now() }) {
  if (!secret || !ticket || !userId || typeof imageUrl !== 'string') return null;
  for (const [consumedTicket, expiresAt] of consumedTickets) {
    if (expiresAt <= now) consumedTickets.delete(consumedTicket);
  }
  if (consumedTickets.has(ticket)) return null;
  const [payload, signature, extra] = String(ticket).split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret), 'base64url');
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsed.userId !== String(userId)
      || !Number.isFinite(parsed.expiresAt)
      || parsed.expiresAt <= now
      || !parsed.publicId.startsWith(uploadFolder)
      || publicIdFromUrl(imageUrl) !== parsed.publicId) return null;
    return parsed.publicId;
  } catch {
    return null;
  }
}

export function consumeCloudinaryCleanupTicket(ticket, now = Date.now()) {
  if (!ticket) return;
  try {
    const [payload] = String(ticket).split('.');
    const { expiresAt } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (Number.isFinite(expiresAt) && expiresAt > now) consumedTickets.set(String(ticket), expiresAt);
  } catch {
    return;
  }
}
