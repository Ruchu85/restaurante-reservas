"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types";

interface CustomerComboboxProps {
  value: string;
  customers: Customer[];
  onChange: (name: string, preferredService?: string | null) => void;
  required?: boolean;
}

export function CustomerCombobox({ value, customers, onChange, required }: CustomerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep query in sync if parent resets
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered =
    query.length >= 1
      ? customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
      : [];

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v, null);
    setOpen(true);
  }

  function handleSelect(customer: Customer) {
    setQuery(customer.name);
    onChange(customer.name, customer.preferred_service);
    setOpen(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={handleInputChange}
        onFocus={() => query.length >= 1 && setOpen(true)}
        required={required}
        minLength={2}
        placeholder="Ana García"
        autoComplete="off"
        autoFocus
      />

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-auto text-sm">
          {filtered.map((c) => (
            <li
              key={c.id}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click registers
                handleSelect(c);
              }}
              className={cn(
                "flex flex-col px-3 py-2 cursor-pointer hover:bg-slate-50",
                c.name.toLowerCase() === query.toLowerCase() && "bg-slate-50",
              )}
            >
              <span className="font-medium">{c.name}</span>
              {c.preferred_service && (
                <span className="text-xs text-muted-foreground">{c.preferred_service}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
