import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhoneDisplay, normalizePhoneField, parsePhoneField, phoneFieldError } from '@/lib/phone';

interface PhoneFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}

/**
 * Phone input that validates as you type and auto-normalizes to E.164 on blur,
 * so every number saved on a client record can be dialed/texted by Telnyx.
 */
export function PhoneField({
  id = 'phone',
  label = 'Phone Number',
  value,
  onChange,
  placeholder = '(601) 555-0123',
  required = false,
  helpText,
}: PhoneFieldProps) {
  const [touched, setTouched] = useState(false);
  const error = phoneFieldError(value) ?? (required && !value.trim() ? 'Phone number is required.' : null);
  const { valid } = parsePhoneField(value);
  const showError = touched && !!error;

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}{required && ' *'}</Label>}
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          setTouched(true);
          const normalized = normalizePhoneField(value);
          if (normalized && normalized !== value.trim()) onChange(normalized);
        }}
        placeholder={placeholder}
        aria-invalid={showError}
        className={showError ? 'border-destructive focus-visible:ring-destructive' : undefined}
      />
      {showError ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : valid.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Will be saved as {valid.map(formatPhoneDisplay).join(', ')} ({valid.join(', ')})
        </p>
      ) : (
        helpText && <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}

export default PhoneField;
