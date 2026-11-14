import { useEffect, useRef } from 'react';

type AutosaveOptions<T> = {
  value: T;
  enabled: boolean;
  save: (value: T) => Promise<unknown>;
  onSaving: () => void;
  onSaved: (result: unknown) => void;
  onError: (error: unknown) => void;
  delay?: number;
};

export function useDebouncedAutosave<T>({ value, enabled, save, onSaving, onSaved, onError, delay = 250 }: AutosaveOptions<T>) {
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const callbacksRef = useRef({ onSaving, onSaved, onError });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);
  const inFlightRef = useRef(false);
  const generationRef = useRef(0);

  valueRef.current = value;
  saveRef.current = save;
  callbacksRef.current = { onSaving, onSaved, onError };

  useEffect(() => {
    if (!enabled) return;
    pendingRef.current = valueRef.current;
    const generation = ++generationRef.current;
    callbacksRef.current.onSaving();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush(generation);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [value, enabled, delay]);

  async function flush(generation: number) {
    if (inFlightRef.current || pendingRef.current === null) return;
    const snapshot = pendingRef.current;
    pendingRef.current = null;
    inFlightRef.current = true;
    try {
      const result = await saveRef.current(snapshot);
      if (generation === generationRef.current) callbacksRef.current.onSaved(result);
    } catch (error) {
      if (generation === generationRef.current) callbacksRef.current.onError(error);
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current !== null) void flush(generationRef.current);
    }
  }
}
