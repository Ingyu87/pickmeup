export const TOAST_EVENT = 'pickmeup:toast';

export function showToast(message: string): void {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}
