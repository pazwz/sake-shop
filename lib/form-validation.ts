export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const focusFormField = (form: HTMLFormElement, fieldName: string) => {
  const field = form.elements.namedItem(fieldName);
  if (field instanceof HTMLElement) field.focus();
};

export const invalidFieldClass = 'border-[#6d2227] focus:border-[#6d2227]';
