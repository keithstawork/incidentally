import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProShift, FormValues } from "./helpers";
import {
  formSchema,
  shiftDate,
  formatLocalDate,
  extractStateCode,
  SHIFT_POSITIONS,
  US_STATES,
} from "./helpers";
import { StepCard } from "./step-card";
import { ProSearchStep } from "./pro-search-step";
import { ShiftDetailsStep } from "./shift-details-step";
import { ClaimDetailsStep } from "./claim-details-step";

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
  const watchedFirstName = form.watch("firstName");
  const watchedLastName = form.watch("lastName");
  const watchedPartner = form.watch("partnerName");
  const watchedProId = form.watch("proId");

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
    } catch (err) { console.error("Failed to fetch shifts:", err); }
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
    } catch (err) { console.error("Failed to fetch monthly shifts:", err); }
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
    } catch (err) { console.error("Failed to fetch open claims:", err); }
    finally { setOpenClaimsLoading(false); }
  }, []);

  const fetchShiftStats = useCallback(async (proId: number) => {
    setShiftStatsLoading(true);
    setShiftStats(null);
    try {
      const res = await fetch(`/api/pros/${proId}/shift-stats`, { credentials: "include" });
      if (res.ok) setShiftStats(await res.json());
    } catch (err) { console.error("Failed to fetch shift stats:", err); }
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
    [form],
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
    [form, shiftDateMap, applyShiftFields],
  );

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
        } catch (err) { console.error("Policy auto-fill failed:", err); }
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
            <StepCard
              stepNum={1}
              currentStep={step}
              label=""
              summary={step1Summary}
              onClickHeader={() => goToStep(1)}
            >
              <ProSearchStep
                form={form}
                step={step}
                setStep={setStep}
                proKnown={proKnown}
                setProKnown={setProKnown}
                dateKnown={dateKnown}
                selectedPro={selectedPro}
                setSelectedPro={setSelectedPro}
                recentShifts={recentShifts}
                shiftsLoading={shiftsLoading}
                selectedShiftId={selectedShiftId}
                monthLoading={monthLoading}
                shiftStats={shiftStats}
                shiftStatsLoading={shiftStatsLoading}
                openClaims={openClaims}
                openClaimsLoading={openClaimsLoading}
                canAdvanceStep1={canAdvanceStep1}
                handleUnknownPro={handleUnknownPro}
                handleUnknownDate={handleUnknownDate}
                handleCalendarSelect={handleCalendarSelect}
                handleMonthChange={handleMonthChange}
                defaultCalendarMonth={defaultCalendarMonth}
                shiftDateMap={shiftDateMap}
                applyShiftFields={applyShiftFields}
                fetchShifts={fetchShifts}
                fetchOpenClaims={fetchOpenClaims}
                fetchShiftStats={fetchShiftStats}
              />
            </StepCard>

            <StepCard
              stepNum={2}
              currentStep={step}
              label=""
              summary={watchedPartner ? `${watchedPartner}${form.getValues("partnerState") ? `, ${form.getValues("partnerState")}` : ""}` : ""}
              onClickHeader={() => goToStep(2)}
            >
              <ShiftDetailsStep form={form} step={step} setStep={setStep} />
            </StepCard>

            <StepCard
              stepNum={3}
              currentStep={step}
              label=""
              summary=""
              onClickHeader={() => goToStep(3)}
            >
              <ClaimDetailsStep form={form} setStep={setStep} isPending={createMutation.isPending} />
            </StepCard>
          </form>
        </Form>
      </div>
    </div>
  );
}
