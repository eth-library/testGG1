import { app } from '../app/services.ts';

/** Absoluter Permalink zu einem Bild. */
export function permalink(id: string): string {
  return new URL(app().router.href(`/bild/${encodeURIComponent(id)}`), location.origin).href;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback für ältere Browser / fehlende Berechtigung
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/** Teilen über das System-Menü (falls vorhanden), sonst Link kopieren. */
export async function share(title: string, url: string, preferCopy = false): Promise<void> {
  const { toast, i18n, analytics } = app();
  analytics.event('Share', preferCopy ? 'copy' : 'share', url);
  if (!preferCopy && navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
  }
  if (await copyText(url)) toast.show(i18n.t('detail.linkCopied'), { icon: 'link' });
}

/** Startet einen Datei-Download über einen temporären Link. */
export function triggerDownload(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.dataset.router = 'off';
  if (filename) a.download = filename;
  else a.target = '_blank';
  document.body.append(a);
  a.click();
  a.remove();
}

/** mailto- oder URL-Link mit Bildbezug (Bestellung, Fehlermeldung). */
export function contactHref(
  target: { mode: 'mailto' | 'url'; target: string; subject?: string | Record<string, string> },
  context: { id: string; title: string; signature?: string },
): string {
  const { i18n } = app();
  const link = permalink(context.id);
  const subject = `${i18n.pick(target.subject, '')} ${context.signature ?? ''} ${context.title}`.trim();
  if (target.mode === 'mailto') {
    const body = `${context.title}\n${context.signature ?? ''}\n${link}\n\n`;
    return `mailto:${target.target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  const url = new URL(target.target);
  url.searchParams.set('asset', context.id);
  url.searchParams.set('title', context.title);
  url.searchParams.set('link', link);
  return url.href;
}
