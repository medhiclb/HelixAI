import { createHash } from "node:crypto";
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function stableId(value) {
  const h = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(
    17,
    20
  )}-${h.slice(20, 32)}`;
}
export function emails(value) {
  const input = Array.isArray(value) ? value.join(",") : String(value || "");
  if (/[\r\n]/.test(input)) throw new AppError("Adresse email invalide.");
  const extracted = input.match(
    /(?:[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
  );
  if (extracted?.length)
    return [...new Set(extracted.map((x) => x.toLowerCase()))];
  return input
    .split(/[;,]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}
export function recipients(value) {
  const input = Array.isArray(value) ? value.join(",") : String(value || "");
  if (/[\r\n]/.test(input)) throw new AppError("Adresse email invalide.");
  const parts = input
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const result = [
    ...new Set(
      parts.map((x) => (x.match(/<([^>]+)>/)?.[1] || x).toLowerCase())
    ),
  ];
  if (
    !result.length ||
    result.length > 30 ||
    result.some(
      (x) => !/^[-.!#$%&'*+/=?^_`{|}~a-z0-9]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(x)
    )
  )
    throw new AppError("Indiquez entre 1 et 30 adresses email valides.");
  return result;
}
export function validateMeeting(record) {
  if (!record?.name?.trim()) throw new AppError("Un titre est nécessaire.");
  const a = new Date(record.starts_at),
    b = new Date(record.ends_at);
  if (!Number.isFinite(+a) || !Number.isFinite(+b) || b <= a)
    throw new AppError("Les dates du rendez-vous sont invalides.");
  if (b - a > 31 * 86400000)
    throw new AppError("La durée ne doit pas dépasser 31 jours.");
  return {
    ...record,
    name: record.name.trim().slice(0, 300),
    starts_at: a.toISOString(),
    ends_at: b.toISOString(),
    attendees: record.attendees ? recipients(record.attendees) : [],
  };
}
export function googleMime({ from, to, subject, body, inReplyTo }) {
  if (
    /[\r\n]/.test(subject) ||
    /[\r\n]/.test(from) ||
    (inReplyTo && /[\r\n]/.test(inReplyTo))
  )
    throw new AppError("En-tête du message invalide.");
  const headers = [
    `From: ${from}`,
    `To: ${recipients(to).join(", ")}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (inReplyTo)
    headers.push(`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`);
  return Buffer.from(
    headers.join("\r\n") +
      "\r\n\r\n" +
      Buffer.from(body)
        .toString("base64")
        .match(/.{1,76}/g)
        ?.join("\r\n")
  ).toString("base64url");
}
export function safeNext(url, provider) {
  const parsed = new URL(url);
  const allowed =
    provider === "google"
      ? ["www.googleapis.com", "gmail.googleapis.com"]
      : ["graph.microsoft.com"];
  if (parsed.protocol !== "https:" || !allowed.includes(parsed.hostname))
    throw new AppError("Curseur de synchronisation invalide.");
  return parsed.href;
}
export function plainGoogle(part) {
  if (part?.mimeType === "text/plain" && part.body?.data)
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const p of part?.parts || []) {
    const text = plainGoogle(p);
    if (text) return text;
  }
  return "";
}
export function check(result) {
  if (result.error) throw result.error;
  return result.data;
}

export function htmlText(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>(?!$)|<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
export function googleBody(part) {
  const text = plainGoogle(part);
  if (text) return text;
  function html(p) {
    if (p?.mimeType === "text/html" && p.body?.data)
      return Buffer.from(p.body.data, "base64url").toString("utf8");
    for (const child of p?.parts || []) {
      const found = html(child);
      if (found) return found;
    }
    return "";
  }
  return htmlText(html(part));
}
