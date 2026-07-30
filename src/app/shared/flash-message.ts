import { DestroyRef, signal, WritableSignal } from '@angular/core';

const DEFAULT_DURATION_MS = 5000;

export interface FlashMessage {
  readonly message: WritableSignal<string | null>;
  show(text: string): void;
  clear(): void;
}

/** Auto-clears success/info messages after a short delay. */
export function createFlashMessage(
  destroyRef: DestroyRef,
  durationMs = DEFAULT_DURATION_MS,
): FlashMessage {
  const message = signal<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  destroyRef.onDestroy(clearTimer);

  return {
    message,
    show(text: string): void {
      clearTimer();
      message.set(text);
      timer = setTimeout(() => {
        message.set(null);
        timer = null;
      }, durationMs);
    },
    clear(): void {
      clearTimer();
      message.set(null);
    },
  };
}
