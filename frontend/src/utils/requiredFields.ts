type RequiredField = {
  label: string;
  value?: unknown;
  valid?: boolean;
};

type Toast = {
  tone: 'success' | 'error';
  title: string;
  message?: string;
};

export function getMissingFields(fields: RequiredField[]) {
  return fields
    .filter((field) => field.valid === false || (field.valid === undefined && isBlank(field.value)))
    .map((field) => field.label);
}

export function formatMissingFields(missing: string[]) {
  return `Please fill: ${missing.join(', ')}.`;
}

export function showMissingFieldsToast(showToast: (toast: Toast) => void, missing: string[], title = 'Required fields missing') {
  if (!missing.length) return false;
  showToast({
    tone: 'error',
    title,
    message: formatMissingFields(missing)
  });
  return true;
}

function isBlank(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'number') return !Number.isFinite(value);
  return false;
}
