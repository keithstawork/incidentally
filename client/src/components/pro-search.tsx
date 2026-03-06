import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, User } from "lucide-react";

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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: results = [], isFetching } = useQuery<Pro[]>({
    queryKey: ["/api/pros", "search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/pros/search?q=${encodeURIComponent(debouncedQuery)}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (results.length > 0 && debouncedQuery.length >= 2) {
      setIsOpen(true);
      setSelectedIndex(-1);
    } else if (debouncedQuery.length < 2) {
      setIsOpen(false);
    }
  }, [results, debouncedQuery]);

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 300);
  }, [onChange]);

  const selectPro = useCallback((pro: Pro) => {
    setQuery(String(pro.proId));
    onChange(String(pro.proId));
    setIsOpen(false);
    setDebouncedQuery("");
    onProSelected?.(pro);
  }, [onChange, onProSelected]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [isOpen, selectedIndex, results, selectPro]);

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
          onFocus={() => results.length > 0 && debouncedQuery.length >= 2 && setIsOpen(true)}
          placeholder="Search by ID, name, or email..."
          className={className}
          data-testid="input-pro-search"
        />
        {isFetching && (
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-pulse text-primary" />
        )}
      </div>

      {isFetching && debouncedQuery.length >= 2 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover px-3 py-2.5 shadow-lg">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Search className="h-3.5 w-3.5 animate-pulse text-primary" />
            <span>Searching for &ldquo;{debouncedQuery}&rdquo;&hellip;</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-primary animate-shimmer" />
          </div>
        </div>
      )}

      {isOpen && !isFetching && (
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
