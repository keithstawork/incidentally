import { useCallback, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  ArrowLeft, ArrowRight, Loader2, Briefcase, Building2,
  CheckCircle2, AlertTriangle, Clock, HelpCircle,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ProSearch } from "@/components/pro-search";
import type { DayContentProps } from "react-day-picker";
import type { FormValues, ProShift } from "./helpers";
import { shiftDate, formatLocalDate, daysBetween } from "./helpers";

interface SelectedPro {
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  locality: string | null;
  stateCode: string | null;
  zipcode: string | null;
  dateCreated: string | null;
}

interface ProSearchStepProps {
  form: UseFormReturn<any>;
  step: number;
  setStep: (n: number) => void;
  proKnown: boolean;
  setProKnown: (v: boolean) => void;
  dateKnown: boolean;
  selectedPro: SelectedPro | null;
  setSelectedPro: (p: SelectedPro | null) => void;
  recentShifts: ProShift[];
  shiftsLoading: boolean;
  selectedShiftId: number | null;
  monthLoading: boolean;
  shiftStats: { totalShifts: number; w2Shifts: number; nonW2Shifts: number } | null;
  shiftStatsLoading: boolean;
  openClaims: { id: number; dateOfInjury: string; partnerName: string | null; injuryType: string | null }[];
  openClaimsLoading: boolean;
  canAdvanceStep1: boolean;
  handleUnknownPro: () => void;
  handleUnknownDate: () => void;
  handleCalendarSelect: (date: Date | undefined) => void;
  handleMonthChange: (month: Date) => void;
  defaultCalendarMonth: Date;
  shiftDateMap: Map<string, ProShift>;
  applyShiftFields: (shift: ProShift) => void;
  fetchShifts: (proId: number) => void;
  fetchOpenClaims: (proId: number) => void;
  fetchShiftStats: (proId: number) => void;
}

export function ProSearchStep({
  form,
  step,
  setStep,
  proKnown,
  setProKnown,
  dateKnown,
  selectedPro,
  setSelectedPro,
  recentShifts,
  shiftsLoading,
  monthLoading,
  shiftStats,
  shiftStatsLoading,
  openClaims,
  openClaimsLoading,
  canAdvanceStep1,
  handleUnknownPro,
  handleUnknownDate,
  handleCalendarSelect,
  handleMonthChange,
  defaultCalendarMonth,
  shiftDateMap,
  applyShiftFields,
  fetchShifts,
  fetchOpenClaims,
  fetchShiftStats,
}: ProSearchStepProps) {
  const watchedDate = form.watch("dateOfInjury");

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
    [shiftDateMap],
  );

  return (
    <div className="space-y-4">
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

      {(selectedPro || !proKnown) && (
        <>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-stretch">
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
  );
}
