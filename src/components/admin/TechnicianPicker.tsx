import { useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface TechnicianOption {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface TechnicianPickerProps {
  technicians: TechnicianOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}

export function TechnicianPicker({
  technicians,
  value,
  onChange,
  placeholder = 'Select a technician',
  emptyLabel = 'No technician',
  disabled,
}: TechnicianPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeAndRefocus = () => {
    setOpen(false);
    // return focus to the trigger so tab order stays predictable inside dialogs
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selected = useMemo(
    () => technicians.find((tech) => tech.id === value),
    [technicians, value],
  );

  const label = (tech: TechnicianOption) =>
    `${tech.name || 'Unnamed technician'}${tech.email ? ` - ${tech.email}` : ''}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <User className="h-4 w-4 shrink-0 opacity-60" />
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected ? label(selected) : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[300] w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search by name or email..." />
          <CommandList>
            <CommandEmpty>No technicians found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={emptyLabel}
                onSelect={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                {emptyLabel}
              </CommandItem>
              {technicians.map((tech) => (
                <CommandItem
                  key={tech.id}
                  value={`${label(tech)} ${tech.id}`}
                  onSelect={() => {
                    onChange(tech.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === tech.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{label(tech)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default TechnicianPicker;
