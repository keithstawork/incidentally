import type { UseFormReturn } from "react-hook-form";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormValues } from "./helpers";
import { SHIFT_POSITIONS, US_STATES } from "./helpers";

interface ShiftDetailsStepProps {
  form: UseFormReturn<any>;
  step: number;
  setStep: (n: number) => void;
}

export function ShiftDetailsStep({ form, step, setStep }: ShiftDetailsStepProps) {
  return (
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
  );
}
