export type FileLike = {
  url?: string | null;
  fileUrl?: string | null;
  publicUrl?: string | null;
  documentUrl?: string | null;
  certificate?: FileLike | null;
  file?: FileLike | null;
};

export const NO_FILE_AVAILABLE = 'No file available';

export function resolveFileUrl(file: FileLike | null | undefined): string {
  if (!file) return '';
  const direct = [file.url, file.fileUrl, file.publicUrl, file.documentUrl].find(isUsableUrl);
  if (direct) return direct;
  return resolveFileUrl(file.certificate) || resolveFileUrl(file.file);
}

export function hasFileUrl(file: FileLike | null | undefined): boolean {
  return Boolean(resolveFileUrl(file));
}

export function openFile(file: FileLike | null | undefined): boolean {
  const url = resolveFileUrl(file);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function downloadFile(file: FileLike | null | undefined, fileName?: string): boolean {
  const url = resolveFileUrl(file);
  if (!url) return false;
  const link = document.createElement('a');
  link.href = url;
  if (fileName) link.download = fileName;
  link.rel = 'noreferrer';
  link.target = '_blank';
  link.click();
  return true;
}

function isUsableUrl(value: string | null | undefined): value is string {
  return Boolean(value && value.trim());
}
