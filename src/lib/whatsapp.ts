/**
 * wa.me share link. With a mobile number it opens a chat with that person;
 * without one WhatsApp asks who to send it to. No paid API involved.
 */
export function whatsappLink(text: string, mobile?: string): string {
  const encoded = encodeURIComponent(text);
  if (mobile && /^03\d{9}$/.test(mobile)) {
    return `https://wa.me/92${mobile.slice(1)}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
