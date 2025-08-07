import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { validateAddress, type AddressComponents } from '@/lib/address-validation';
import { cn } from '@/lib/utils';

interface AddressInputProps {
  value: string;
  onChange: (value: string, components?: AddressComponents) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  label?: string;
  error?: string;
}

export const AddressInput = React.forwardRef<HTMLInputElement, AddressInputProps>(
  ({ value, onChange, placeholder = "123 Main St, City, State, ZIP", required, className, label = "Address", error, ...props }, ref) => {
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<{
      isValid: boolean;
      error?: string;
      components?: AddressComponents;
    } | null>(null);

    const handleValidation = useCallback(async () => {
      if (!value.trim()) {
        setValidationResult(null);
        return;
      }

      setIsValidating(true);
      try {
        const result = await validateAddress(value);
        setValidationResult(result);
        
        if (result.isValid && result.components) {
          onChange(value, result.components);
        } else {
          onChange(value);
        }
      } catch (error) {
        setValidationResult({
          isValid: false,
          error: 'Validation failed. Please check your address.'
        });
        onChange(value);
      } finally {
        setIsValidating(false);
      }
    }, [value, onChange]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      setValidationResult(null);
    };

    const showValidationIcon = validationResult && !isValidating;
    const isValid = validationResult?.isValid;
    const validationError = error || validationResult?.error;

    return (
      <div className="space-y-2">
        <Label htmlFor="address">{label}{required && ' *'}</Label>
        <div className="relative">
          <Input
            ref={ref}
            value={value}
            onChange={handleInputChange}
            onBlur={handleValidation}
            placeholder={placeholder}
            className={cn(
              "pr-20",
              isValid && "border-green-500",
              validationError && "border-destructive",
              className
            )}
            required={required}
            {...props}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isValidating && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {showValidationIcon && (
              <>
                {isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
              </>
            )}
            {value.length > 5 && !isValidating && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleValidation}
                className="h-6 px-2 text-xs"
              >
                Verify
              </Button>
            )}
          </div>
        </div>
        {validationError && (
          <p className="text-sm text-destructive">{validationError}</p>
        )}
        {isValid && validationResult?.components && (
          <p className="text-sm text-green-600">
            ✓ Valid address in {validationResult.components.city}, {validationResult.components.state}
          </p>
        )}
      </div>
    );
  }
);

AddressInput.displayName = "AddressInput";