import React, { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useUsernameValidation } from '@/hooks/useUsernameValidation';
import { cn } from '@/lib/utils';

interface UsernameInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  onValidationChange?: (isValid: boolean) => void;
}

export const UsernameInput = forwardRef<HTMLInputElement, UsernameInputProps>(
  ({ className, label = "Username", onValidationChange, ...props }, ref) => {
    const { isValidating, isAvailable, error } = useUsernameValidation({
      username: props.value as string || '',
    });

    // Call validation callback when validation state changes
    React.useEffect(() => {
      if (onValidationChange) {
        const isValid = isAvailable === true && !error && !isValidating;
        onValidationChange(isValid);
      }
    }, [isAvailable, error, isValidating, onValidationChange]);

    const getValidationIcon = () => {
      if (!props.value || (props.value as string).length < 3) return null;
      
      if (isValidating) {
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      }
      
      if (error) {
        return <XCircle className="h-4 w-4 text-destructive" />;
      }
      
      if (isAvailable === true) {
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      }
      
      if (isAvailable === false) {
        return <XCircle className="h-4 w-4 text-destructive" />;
      }
      
      return null;
    };

    const getValidationMessage = () => {
      if (!props.value || (props.value as string).length < 3) {
        return "Username must be at least 3 characters";
      }
      
      if (isValidating) {
        return "Checking availability...";
      }
      
      if (error) {
        return error;
      }
      
      if (isAvailable === true) {
        return "Username is available";
      }
      
      if (isAvailable === false) {
        return "Username is already taken";
      }
      
      return null;
    };

    const getInputClasses = () => {
      if (!props.value || (props.value as string).length < 3) return '';
      
      if (isAvailable === true) return 'border-green-500 focus:border-green-500';
      if (isAvailable === false || error) return 'border-destructive focus:border-destructive';
      
      return '';
    };

    return (
      <div className="space-y-2">
        <Label htmlFor={props.id}>{label}</Label>
        <div className="relative">
          <Input
            ref={ref}
            className={cn(getInputClasses(), className)}
            {...props}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {getValidationIcon()}
          </div>
        </div>
        {getValidationMessage() && (
          <p className={cn(
            "text-sm",
            isAvailable === true && "text-green-600",
            (isAvailable === false || error) && "text-destructive",
            isValidating && "text-muted-foreground"
          )}>
            {getValidationMessage()}
          </p>
        )}
      </div>
    );
  }
);

UsernameInput.displayName = "UsernameInput";