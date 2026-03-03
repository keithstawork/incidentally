import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, Loader2, MapPin, Briefcase, Building2,
  CheckCircle2, AlertTriangle, Clock, User, ChevronDown,
  FileText, HelpCircle,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProSearch } from "@/components/pro-search";
import { insertClaimSchema } from "@shared/schema";
import { z } from "zod";
import type { DayContentProps } from "react-day-picker";

interface ProShift {
  shiftId: number;
  businessName: string | null;
  position: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string | null;
  regionName: string | null;
  workerRegionName: string | null;
  subRegionName: string | null;
  zipcode: string | null;
  shiftCity: string | null;
  shiftState: string | null;
  shiftAddress: string | null;
  isW2: boolean | null;
}

function extractStateCode(regionName: string | null): string | null {
  if (!regionName) return null;
  const match = regionName.match(/,\s*([A-Z]{2})/);
  return match ? match[1] : null;
}

function shiftDate(shift: ProShift): string | null {
  if (!shift.startsAt) return null;
  return shift.startsAt.slice(0, 10);
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + "T00:00:00").getTime();
  const msB = new Date(b + "T00:00:00").getTime();
  return Math.round((msA - msB) / 86_400_000);
}

const formSchema = insertClaimSchema
  .pick({
    firstName: true,
    lastName: true,
    dateOfInjury: true,
    workerType: true,
    partnerName: true,
    partnerState: true,
    shiftLocation: true,
    injuryType: true,
    shiftType: true,
    proId: true,
    dateSubmitted: true,
    claimType: true,
  })
  .extend({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    dateOfInjury: z.string().min(1, "Date of injury is required"),
    workerType: z.enum(["W2", "1099"]).optional(),
    partnerName: z.string().min(1, "Partner name is required"),
  });

type FormValues = z.infer<typeof formSchema>;

const INJURY_TYPES = [
  "Burn", "Chemical Exposure", "Contusion", "Cut/Laceration",
  "Fall/Slip/Trip", "Falling Object", "Motor Vehicle Accident",
  "Strain: Lifting", "Strain: Repetitive movement", "Other",
];

const SHIFT_POSITIONS = [
  "Banquet Server", "Barista", "Bartender", "Catering Server",
  "Custodial", "Dishwasher", "Event Server", "Event Staff",
  "Food Runner", "Forklift Operator", "Front Desk",
  "General Labor", "Housekeeper", "Line Cook", "Prep Cook",
  "Security Guard", "Warehouse Associate", "Other",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const STEP_ICONS = [User, Briefcase, FileText];
const STEP_LABELS = ["Injured Worker & Date of Injury", "Shift Details", "Claim Details"];

export default function ClaimNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [recentShifts, setRecentShifts] = useState<ProShift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [proKnown, setProKnown] = useState(true);
  const [dateKnown, setDateKnown] = useState(true);
  const [selectedPro, setSelectedPro] = useState<{
    givenName: string | null;
    familyName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    locality: string | null;
    stateCode: string | null;
    zipcode: string | null;
    dateCreated: string | null;
  } | null>(null);
  const [shiftStats, setShiftStats] = useState<{
    totalShifts: number;
    w2Shifts: number;
    nonW2Shifts: number;
  } | null>(null);
  const [shiftStatsLoading, setShiftStatsLoading] = useState(false);
  const [openClaims, setOpenClaims] = useState<
    { id: number; dateOfInjury: string; partnerName: string | null; injuryType: string | null }[]
  >([]);
  const [openClaimsLoading, setOpenClaimsLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const loadedMonthsRef = useRef(new Set<string>());
  const monthDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentProIdRef = useRef<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfInjury: "",
      workerType: undefined,
      partnerName: "",
      injuryType: "",
      shiftType: "",
      tnsSpecialist: "",
      proId: "",
      dateSubmitted: new Date().toISOString().split("T")[0],
      insuredName: "",
      carrier: "",
      claimType: "Pending",
    },
  });

  const watchedDate = form.watch("dateOfInjury");
  const watchedWorkerType = form.watch("workerType");
  const watchedFirstName = form.watch("firstName");
  const watchedLastName = form.watch("lastName");
  const watchedPartner = form.watch("partnerName");
  const watchedProId = form.watch("proId");

  // --- Shift helpers ---

  const shiftDateMap = useMemo(() => {
    const map = new Map<string, ProShift>();
    for (const shift of recentShifts) {
      const d = shiftDate(shift);
      if (d && !map.has(d)) map.set(d, shift);
    }
    return map;
  }, [recentShifts]);

  const defaultCalendarMonth = useMemo(() => {
    if (recentShifts.length > 0) {
      const d = shiftDate(recentShifts[0]);
      if (d) return new Date(d + "T12:00:00");
    }
    return new Date();
  }, [recentShifts]);

  const dateMatchInfo = useMemo(() => {
    if (!watchedDate || recentShifts.length === 0) return null;
    const exactMatch = shiftDateMap.get(watchedDate);
    if (exactMatch) return { match: true as const, shift: exactMatch };
    const nearby = recentShifts
      .filter((s) => {
        const d = shiftDate(s);
        if (!d) return false;
        return Math.abs(daysBetween(watchedDate, d)) > 0 && Math.abs(daysBetween(watchedDate, d)) <= 3;
      })
      .sort((a, b) => Math.abs(daysBetween(watchedDate, shiftDate(a)!)) - Math.abs(daysBetween(watchedDate, shiftDate(b)!)));
    return { match: false as const, nearby };
  }, [watchedDate, recentShifts, shiftDateMap]);

  const ShiftDayContent = useCallback(
    (props: DayContentProps) => {
      const dateStr = formatLocalDate(props.date);
      const shift = shiftDateMap.get(dateStr);
      return (
        <div className="relative flex flex-col items-center justify-center w-full h-full">
          <span>{props.date.getDate()}</span>
          {shift && (
            <span className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${shift.isW2 ? "bg-[#3B5747]" : "bg-[#EC5A53]"}`} />
          )}
        </div>
      );
    },
    [shiftDateMap]
  );

  const fetchShifts = useCallback(async (proId: number) => {
    setShiftsLoading(true);
    setRecentShifts([]);
    setSelectedShiftId(null);
    loadedMonthsRef.current = new Set();
    currentProIdRef.current = proId;
    try {
      const peekRes = await fetch(`/api/pros/${proId}/shifts?limit=1`, { credentials: "include" });
      if (!peekRes.ok) return;
      const peek: ProShift[] = await peekRes.json();
      if (peek.length === 0) return;
      const latest = peek[0].startsAt;
      if (!latest) return;
      const monthKey = latest.slice(0, 7);
      loadedMonthsRef.current.add(monthKey);
      const res = await fetch(`/api/pros/${proId}/shifts?month=${monthKey}`, { credentials: "include" });
      if (res.ok) {
        const data: ProShift[] = await res.json();
        setRecentShifts(data);
      }
    } catch { /* silently fail */ }
    finally { setShiftsLoading(false); }
  }, []);

  const fetchShiftsForMonth = useCallback(async (proId: number, monthKey: string) => {
    if (loadedMonthsRef.current.has(monthKey)) return;
    loadedMonthsRef.current.add(monthKey);
    setMonthLoading(true);
    try {
      const res = await fetch(`/api/pros/${proId}/shifts?month=${monthKey}`, { credentials: "include" });
      if (res.ok) {
        const data: ProShift[] = await res.json();
        if (data.length > 0) {
          setRecentShifts((prev) => {
            const existingIds = new Set(prev.map((s) => s.shiftId));
            const newShifts = data.filter((s) => !existingIds.has(s.shiftId));
            return newShifts.length > 0 ? [...prev, ...newShifts] : prev;
          });
        }
      }
    } catch { /* silently fail */ }
    finally { setMonthLoading(false); }
  }, []);

  const handleMonthChange = useCallback((month: Date) => {
    if (monthDebounceRef.current) clearTimeout(monthDebounceRef.current);
    const proId = currentProIdRef.current;
    if (!proId) return;
    monthDebounceRef.current = setTimeout(() => {
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      fetchShiftsForMonth(proId, key);
    }, 600);
  }, [fetchShiftsForMonth]);

  useEffect(() => {
    return () => {
      if (monthDebounceRef.current) clearTimeout(monthDebounceRef.current);
    };
  }, []);

  const fetchOpenClaims = useCallback(async (proId: number) => {
    setOpenClaimsLoading(true);
    setOpenClaims([]);
    try {
      const res = await fetch(`/api/pros/${proId}/open-claims`, { credentials: "include" });
      if (res.ok) setOpenClaims(await res.json());
    } catch { /* silently fail */ }
    finally { setOpenClaimsLoading(false); }
  }, []);

  const fetchShiftStats = useCallback(async (proId: number) => {
    setShiftStatsLoading(true);
    setShiftStats(null);
    try {
      const res = await fetch(`/api/pros/${proId}/shift-stats`, { credentials: "include" });
      if (res.ok) setShiftStats(await res.json());
    } catch { /* silently fail */ }
    finally { setShiftStatsLoading(false); }
  }, []);

  const applyShiftFields = useCallback(
    (shift: ProShift) => {
      setSelectedShiftId(shift.shiftId);
      const date = shiftDate(shift);
      if (date) form.setValue("dateOfInjury", date);
      if (shift.businessName) form.setValue("partnerName", shift.businessName);
      if (shift.isW2 !== null && shift.isW2 !== undefined) {
        form.setValue("workerType", shift.isW2 ? "W2" : "1099");
      }
      if (shift.position) {
        const matched = SHIFT_POSITIONS.find((t) => t.toLowerCase() === shift.position!.toLowerCase());
        form.setValue("shiftType", matched || shift.position);
      }
      // Use reverse-geocoded shift location (derived from gig template geocode)
      if (shift.shiftState && US_STATES.includes(shift.shiftState)) {
        form.setValue("partnerState", shift.shiftState);
      } else {
        const fallback = extractStateCode(shift.regionName);
        if (fallback && US_STATES.includes(fallback)) {
          form.setValue("partnerState", fallback);
        }
      }
      if (shift.shiftAddress) {
        form.setValue("shiftLocation", shift.shiftAddress);
      } else if (shift.regionName) {
        form.setValue("shiftLocation", shift.regionName);
      }
    },
    [form]
  );

  const handleCalendarSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      const dateStr = formatLocalDate(date);
      form.setValue("dateOfInjury", dateStr);
      const matchedShift = shiftDateMap.get(dateStr);
      if (matchedShift) {
        applyShiftFields(matchedShift);
      } else {
        setSelectedShiftId(null);
        form.setValue("partnerName", "");
        form.setValue("partnerState", "");
        form.setValue("shiftLocation", "");
        form.setValue("workerType", undefined as any);
        form.setValue("shiftType", "");
      }
    },
    [form, shiftDateMap, applyShiftFields]
  );

  // --- Step navigation ---

  const canAdvanceStep1 = (proKnown
    ? !!(watchedProId || (watchedFirstName && watchedLastName))
    : !!(watchedFirstName && watchedLastName))
    && (dateKnown ? !!watchedDate : true);

  const goToStep = (target: number) => {
    if (target < step) setStep(target);
    if (target === 2 && canAdvanceStep1) setStep(2);
    if (target === 3 && step >= 2) setStep(3);
  };

  const handleUnknownPro = () => {
    setProKnown(false);
    form.setValue("firstName", form.getValues("firstName") || "Unknown");
    form.setValue("lastName", form.getValues("lastName") || "Unknown");
  };

  const handleUnknownDate = () => {
    setDateKnown(false);
    form.setValue("dateOfInjury", new Date().toISOString().split("T")[0]);
  };

  // --- Submit ---

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      let carrier = "";
      let policyNumber = "";
      let policyYear = "";
      let insuredName = "";
      if (data.workerType && data.dateOfInjury) {
        try {
          const params = new URLSearchParams({
            workerType: data.workerType,
            dateOfInjury: data.dateOfInjury,
            litigated: "false",
          });
          const policyRes = await fetch(`/api/policies/applicable?${params}`, { credentials: "include" });
          if (policyRes.ok) {
            const { policy } = await policyRes.json();
            if (policy) {
              carrier = policy.carrierName || "";
              policyNumber = policy.policyNumber || "";
              policyYear = policy.policyYearStart && policy.policyYearEnd
                ? `${policy.policyYearStart.slice(0, 4)}-${policy.policyYearEnd.slice(0, 4)}`
                : "";
              insuredName = policy.insuredParty || "";
            }
          }
        } catch { /* proceed without policy auto-fill */ }
      }
      const res = await apiRequest("POST", "/api/claims", {
        ...data,
        stateOfInjury: data.partnerState || "",
        stage: "intake",
        claimStatus: "Open",
        carrier,
        policyNumber,
        policyYear,
        insuredName,
      });
      return res.json();
    },
    onSuccess: (claim) => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", "list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Incident created", description: `Incident ${(claim as any).matterNumber || `#${claim.id}`} has been created.` });
      navigate(`/claims/${claim.id}`);
    },
    onError: (error) => {
      toast({ title: "Error creating claim", description: error.message, variant: "destructive" });
    },
  });

  // --- Step summary for collapsed cards ---

  const proSummary = watchedProId
    ? `Pro ID: ${watchedProId} — ${watchedFirstName} ${watchedLastName}`
    : !proKnown
      ? "Unknown Pro"
      : watchedFirstName && watchedLastName
        ? `${watchedFirstName} ${watchedLastName}`
        : "";

  const dateSummary = !dateKnown
    ? "Date unknown"
    : watchedDate
      ? new Date(watchedDate + "T12:00:00").toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        })
      : "";

  const step1Summary = [proSummary, dateSummary].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/claims" data-testid="button-back-new">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-new-claim-title">
                New Incident
              </h1>
              <p className="text-xs text-muted-foreground">
                Injury intake form for Trust & Safety
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/claims">Cancel</Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="max-w-4xl space-y-3"
          >
            {/* ===== STEP 1: Injured Worker & Date of Injury ===== */}
            <StepCard
              stepNum={1}
              currentStep={step}
              label=""
              summary={step1Summary}
              onClickHeader={() => goToStep(1)}
            >
              <div className="space-y-4">
                {/* --- Pro search --- */}
                {proKnown ? (
                  <div className="space-y-1">
                  <FormField
                    control={form.control}
                    name="proId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Search by Pro ID, name, email, or phone</FormLabel>
                        <FormControl>
                          <ProSearch
                            value={field.value || ""}
                            onChange={field.onChange}
                            onProSelected={(pro) => {
                              setSelectedPro({
                                givenName: pro.givenName,
                                familyName: pro.familyName,
                                email: pro.email,
                                phone: pro.phone,
                                address: pro.address,
                                locality: pro.locality,
                                stateCode: pro.stateCode,
                                zipcode: pro.zipcode,
                                dateCreated: pro.dateCreated,
                              });
                              if (pro.givenName) form.setValue("firstName", pro.givenName);
                              if (pro.familyName) form.setValue("lastName", pro.familyName);
                              if (pro.w2Eligible != null) {
                                form.setValue("workerType", pro.w2Eligible ? "W2" : "1099");
                              }
                              
                              fetchShifts(pro.proId);
                              fetchOpenClaims(pro.proId);
                              fetchShiftStats(pro.proId);
                            }}
                            className="h-9 text-sm"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={handleUnknownPro}
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Pro is unknown
                  </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">First Name</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-8 text-sm" data-testid="input-first-name" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-8 text-sm" data-testid="input-last-name" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => {
                        setProKnown(true);
                        setSelectedPro(null);
                        form.setValue("firstName", "");
                        form.setValue("lastName", "");
                        form.setValue("proId", "");
                      }}
                    >
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      Search for Pro instead
                    </Button>
                  </div>
                )}

                {/* --- Two-column: Pro details (left) + Calendar (right) --- */}
                {(selectedPro || !proKnown) && (
                <>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-stretch">
                  {/* Left: Pro details */}
                  <div className="flex flex-col min-h-0">
                    {selectedPro && proKnown ? (
                      <div className="flex flex-col flex-1 min-h-0">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Pro Details</p>
                        <div className="rounded-md border bg-muted/30 px-4 py-4 flex-1 flex flex-col justify-evenly text-sm">
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Name</p>
                            <p className="font-medium">{selectedPro.givenName} {selectedPro.familyName}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Email</p>
                            <p>{selectedPro.email || "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Phone</p>
                            <p>{selectedPro.phone || "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Address</p>
                            <p>
                              {selectedPro.address
                                || [selectedPro.locality, selectedPro.stateCode, selectedPro.zipcode].filter(Boolean).join(", ")
                                || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Account Created</p>
                            <p>{selectedPro.dateCreated
                              ? new Date(selectedPro.dateCreated).toLocaleDateString("en-US", {
                                  month: "long", day: "numeric", year: "numeric",
                                })
                              : "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Shifts Worked</p>
                            {shiftStatsLoading ? (
                              <p className="text-muted-foreground text-xs">Loading...</p>
                            ) : shiftStats ? (
                              <p>
                                <span className="font-medium">{shiftStats.totalShifts}</span>
                                {shiftStats.totalShifts > 0 && (
                                  <span className="text-muted-foreground text-xs ml-1">
                                    ({shiftStats.w2Shifts} W2 / {shiftStats.nonW2Shifts} 1099)
                                  </span>
                                )}
                              </p>
                            ) : <p>—</p>}
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Open Claims</p>
                            {openClaimsLoading ? (
                              <p className="text-muted-foreground text-xs">Loading...</p>
                            ) : openClaims.length > 0 ? (
                              <div>
                                <p className="text-[#C4A27F] dark:text-[#E7DACC] font-medium">
                                  {openClaims.length} open claim{openClaims.length !== 1 ? "s" : ""}
                                </p>
                                <div className="space-y-0.5 mt-1">
                                  {openClaims.map((c) => (
                                    <Link key={c.id} href={`/claims/${c.id}`} className="block text-xs text-primary hover:underline">
                                      {c.partnerName || "Unknown"} ({c.dateOfInjury}){c.injuryType ? ` — ${c.injuryType}` : ""}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            ) : <p className="text-muted-foreground">None</p>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Manual Entry</p>
                        <p className="text-xs text-muted-foreground">Name entered manually above.</p>
                      </div>
                    )}

                  </div>

                  {/* Right: Calendar */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Date of Injury</p>
                      {recentShifts.length > 0 && !shiftsLoading && (
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#3B5747]" />
                            W2
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#EC5A53]" />
                            1099
                          </span>
                        </div>
                      )}
                    </div>
                    {shiftsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading shift history...
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Calendar
                            mode="single"
                            selected={watchedDate ? new Date(watchedDate + "T12:00:00") : undefined}
                            onSelect={handleCalendarSelect}
                            defaultMonth={defaultCalendarMonth}
                            onMonthChange={handleMonthChange}
                            components={recentShifts.length > 0 ? { DayContent: ShiftDayContent } : undefined}
                            className="rounded-md border p-3"
                          />
                          {monthLoading && (
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading shifts...
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={handleUnknownDate}
                    >
                      <HelpCircle className="h-3 w-3 mr-1" />
                      Date unknown
                    </Button>
                  </div>
                </div>

                {/* Shift detail / mismatch warnings (full-width below the grid) */}
                {step === 1 && watchedDate && dateMatchInfo?.match && (() => {
                  const matchedW2 = dateMatchInfo.shift.isW2;
                  return (
                  <div className={`rounded-md border px-3 py-2 text-xs ${
                    matchedW2
                      ? "border-[#3B5747]/30 bg-[#3B5747]/5 dark:bg-[#3B5747]/10 dark:border-[#3B5747]/40"
                      : "border-[#EC5A53]/30 bg-[#EC5A53]/10 dark:bg-[#EC5A53]/10 dark:border-[#EC5A53]/40"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${
                        matchedW2 ? "text-[#3B5747] dark:text-[#B1BCB5]" : "text-[#EC5A53] dark:text-[#F7A9A9]"
                      }`} />
                      <span className="font-medium">
                        Shift on {new Date(watchedDate + "T12:00:00").toLocaleDateString("en-US", {
                          weekday: "long", month: "long", day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-6 text-[10px] text-muted-foreground">
                      {dateMatchInfo.shift.position && (
                        <span className="flex items-center gap-0.5">
                          <Briefcase className="h-2.5 w-2.5" />
                          {dateMatchInfo.shift.position}
                        </span>
                      )}
                      {dateMatchInfo.shift.businessName && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="h-2.5 w-2.5" />
                          {dateMatchInfo.shift.businessName}
                        </span>
                      )}
                      {dateMatchInfo.shift.startsAt && dateMatchInfo.shift.endsAt && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(dateMatchInfo.shift.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {" – "}
                          {new Date(dateMatchInfo.shift.endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                  );
                })()}

                {step === 1 && watchedDate && recentShifts.length > 0 && dateMatchInfo && !dateMatchInfo.match && (
                  <div className="rounded-md border border-[#C4A27F]/40 bg-[#C4A27F]/10 dark:bg-[#C4A27F]/10 dark:border-[#C4A27F]/40 px-3 py-2">
                    <div className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#C4A27F] dark:text-[#E7DACC] mt-0.5 shrink-0" />
                      <div className="space-y-1.5">
                        <p className="font-medium text-[#76614C] dark:text-[#E7DACC]">
                          No shift found on {new Date(watchedDate + "T12:00:00").toLocaleDateString("en-US", {
                            weekday: "long", month: "long", day: "numeric", year: "numeric",
                          })}
                        </p>
                        {dateMatchInfo.nearby.length > 0 ? (
                          <div>
                            <p className="text-[10px] text-[#76614C] dark:text-[#E7DACC] mb-1">
                              Did you mean one of these nearby shifts?
                            </p>
                            <div className="space-y-0.5">
                              {dateMatchInfo.nearby.map((shift) => {
                                const d = shiftDate(shift)!;
                                const diff = daysBetween(watchedDate, d);
                                const label = diff > 0
                                  ? `${diff} day${diff !== 1 ? "s" : ""} after`
                                  : `${-diff} day${diff !== -1 ? "s" : ""} before`;
                                return (
                                  <button
                                    key={shift.shiftId}
                                    type="button"
                                    onClick={() => applyShiftFields(shift)}
                                    className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-[#C4A27F]/15 dark:hover:bg-[#C4A27F]/10 transition-colors"
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${shift.isW2 ? "bg-[#3B5747]" : "bg-[#EC5A53]"}`} />
                                    <span className="font-medium">
                                      {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                    </span>
                                    <span className="text-[10px] text-[#C4A27F] dark:text-[#E7DACC]">({label})</span>
                                    <span className="text-muted-foreground truncate">— {shift.position} @ {shift.businessName}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-[#76614C] dark:text-[#E7DACC]">
                            No shifts found within 3 days of this date.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                </>
                )}

                {/* --- Continue --- */}

                {step === 1 && (
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canAdvanceStep1}
                      onClick={() => setStep(2)}
                    >
                      Continue
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </StepCard>

            {/* ===== STEP 2: Shift Details ===== */}
            <StepCard
              stepNum={2}
              currentStep={step}
              label=""
              summary={watchedPartner ? `${watchedPartner}${form.getValues("partnerState") ? `, ${form.getValues("partnerState")}` : ""}` : ""}
              onClickHeader={() => goToStep(2)}
            >
              <div className="space-y-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Shift Details</p>
                <div className="rounded-md border bg-muted/30 px-4 py-4 text-sm space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Partner</p>
                      <FormField
                        control={form.control}
                        name="partnerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} className="h-8 text-sm" placeholder="Partner name" data-testid="input-partner" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">State</p>
                      <FormField
                        control={form.control}
                        name="partnerState"
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {US_STATES.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Address / Location</p>
                      <FormField
                        control={form.control}
                        name="shiftLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} value={field.value || ""} className="h-8 text-sm" placeholder="e.g. Phoenix, AZ" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Worker Classification</p>
                      <FormField
                        control={form.control}
                        name="workerType"
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-sm" data-testid="select-worker-type">
                                  <SelectValue placeholder="Select classification" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="W2">W2</SelectItem>
                                <SelectItem value="1099">1099</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Shift Position</p>
                      <FormField
                        control={form.control}
                        name="shiftType"
                        render={({ field }) => {
                          const extraPos = field.value && !SHIFT_POSITIONS.includes(field.value) ? field.value : null;
                          return (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger className="h-8 text-sm" data-testid="select-shift-position">
                                    <SelectValue placeholder="Select position" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {extraPos && <SelectItem value={extraPos}>{extraPos}</SelectItem>}
                                  {SHIFT_POSITIONS.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>

                {step === 2 && (
                  <div className="flex items-center justify-between pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back
                    </Button>
                    <Button type="button" size="sm" onClick={() => setStep(3)}>
                      Continue
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </StepCard>

            {/* ===== STEP 3: Claim Details ===== */}
            <StepCard
              stepNum={3}
              currentStep={step}
              label=""
              summary=""
              onClickHeader={() => goToStep(3)}
            >
              <div className="space-y-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Claim Details</p>
                <div className="rounded-md border bg-muted/30 px-4 py-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Injury Type</p>
                    <FormField
                      control={form.control}
                      name="injuryType"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger className="h-8 text-sm" data-testid="select-injury-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INJURY_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-claim"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Incident"}
                  </Button>
                </div>
              </div>
            </StepCard>
          </form>
        </Form>
      </div>
    </div>
  );
}

// --- Step Card wrapper ---

function StepCard({
  stepNum,
  currentStep,
  label,
  summary,
  onClickHeader,
  children,
}: {
  stepNum: number;
  currentStep: number;
  label: string;
  summary: string;
  onClickHeader: () => void;
  children: React.ReactNode;
}) {
  const isActive = currentStep === stepNum;
  const isCompleted = currentStep > stepNum;
  const isFuture = currentStep < stepNum;
  const Icon = STEP_ICONS[stepNum - 1];

  return (
    <Card className={isFuture ? "opacity-40 pointer-events-none" : ""}>
      <button
        type="button"
        onClick={onClickHeader}
        disabled={isFuture}
        className="w-full text-left"
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 ${
              isCompleted
                ? "bg-primary text-primary-foreground"
                : isActive
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground"
            }`}>
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {STEP_LABELS[stepNum - 1]}
                </h3>
              </div>
              {isCompleted && summary && (
                <p className="text-sm font-medium truncate mt-0.5">{summary}</p>
              )}
              {isActive && label && (
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              )}
            </div>
            {isCompleted && (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </div>
        </CardHeader>
      </button>
      {(isActive || isCompleted) && (
        <CardContent className="p-4 pt-2">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
