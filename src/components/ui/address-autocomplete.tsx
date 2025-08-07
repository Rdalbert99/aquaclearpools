import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MapPin, Loader2 } from 'lucide-react';
import { getAddressSuggestions, type AddressSuggestion, type AddressComponents } from '@/lib/address-validation';
import { cn } from '@/lib/utils';

interface AddressAutocompleteProps {
  onAddressSelect: (components: AddressComponents) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  label?: string;
}

export const AddressAutocomplete = React.forwardRef<HTMLInputElement, AddressAutocompleteProps>(
  ({ onAddressSelect, placeholder = "Start typing an address...", required, className, label = "Address", ...props }, ref) => {
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>();

    const handleInputChange = useCallback(async (value: string) => {
      setInput(value);
      
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (value.length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      // Debounce the API call
      timeoutRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const results = await getAddressSuggestions(value);
          setSuggestions(results);
          setIsOpen(results.length > 0);
        } catch (error) {
          console.error('Failed to fetch address suggestions:', error);
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    }, []);

    const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
      setInput(suggestion.formatted_address);
      setIsOpen(false);
      setSuggestions([]);
      onAddressSelect(suggestion.components);
    };

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <div className="space-y-2">
        <Label htmlFor="address-autocomplete">{label}{required && ' *'}</Label>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Input
                ref={ref}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={placeholder}
                className={cn("pl-10", className)}
                required={required}
                {...props}
              />
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandEmpty>No addresses found.</CommandEmpty>
              <CommandGroup>
                {suggestions.map((suggestion, index) => (
                  <CommandItem
                    key={index}
                    onSelect={() => handleSuggestionSelect(suggestion)}
                    className="flex items-start gap-2 p-3 cursor-pointer hover:bg-accent"
                  >
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{suggestion.components.street_address}</p>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.components.city}, {suggestion.components.state} {suggestion.components.zip_code}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

AddressAutocomplete.displayName = "AddressAutocomplete";