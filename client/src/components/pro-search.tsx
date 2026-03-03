import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, User } from "lucide-react";

interface Pro {
  proId: number;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  locality: string | null;
  state: string | null;
  stateCode: string | null;
  zipcode: string | null;
  workerStatus: string | null;
  w2Eligible: boolean | null;
  dateCreated: string | null;
}

interface ProSearchProps {
  value: string;
  onChange: (proId: string) => void;
  onProSelected?: (pro: Pro) => void;
  className?: string;
}

export function ProSearch({ value, onChange, onProSelected, className }: ProSearchProps) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState<Pro[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/pros/search?q=${encodeURIComponent(q)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setIsOpen(data.length > 0);
        setSelectedIndex(-1);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const selectPro = (pro: Pro) => {
    setQuery(String(pro.proId));
    onChange(String(pro.proId));
    setIsOpen(false);
    onProSelected?.(pro);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      selectPro(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (value !== query) setQuery(value || "");
  }, [value]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search by ID, name, or email..."
          className={className}
          data-testid="input-pro-search"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-auto">
          {results.map((pro, i) => (
            <button
              key={pro.proId}
              type="button"
              className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2 hover:bg-accent/50 transition-colors ${
                i === selectedIndex ? "bg-accent" : ""
              }`}
              onMouseDown={() => selectPro(pro)}
            >
              <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {pro.givenName || pro.familyName
                    ? `${pro.givenName || ""} ${pro.familyName || ""}`.trim()
                    : pro.name || `Pro ID: ${pro.proId}`}
                  {pro.locality && (
                    <span className="font-normal text-muted-foreground ml-1.5">
                      — {pro.locality}{pro.state ? `, ${pro.state}` : ""}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                  <span className="font-mono">ID: {pro.proId}</span>
                  {pro.email && <span className="truncate">{pro.email}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
