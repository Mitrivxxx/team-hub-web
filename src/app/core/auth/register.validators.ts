import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const humanNamePattern = /^\p{L}+(?:[ '-]\p{L}+)*$/u;
const usernamePattern = /^[a-zA-Z0-9._-]{3,30}$/;

export function humanNameValidator(maxLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value as string | null | undefined)?.trim() ?? '';

    if (value.length < 2 || value.length > maxLength || !humanNamePattern.test(value)) {
      return { humanName: true };
    }

    return null;
  };
}

export function usernameFormatValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string | null | undefined)?.trim() ?? '';

  if (!usernamePattern.test(value)) {
    return { usernameFormat: true };
  }

  return null;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailFormatValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string | null | undefined)?.trim() ?? '';

  if (value.length < 3 || value.length > 254 || !emailPattern.test(value)) {
    return { emailFormat: true };
  }

  return null;
}
