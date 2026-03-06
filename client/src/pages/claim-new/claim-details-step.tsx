import type { UseFormReturn } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INJURY_TYPES } from "@/lib/constants";
import type { FormValues } from "./helpers";

interface ClaimDetailsStepProps {
  form: UseFormReturn<any>;
  setStep: (n: number) => void;
  isPending: boolean;
}

export function ClaimDetailsStep({ form, setStep, isPending }: ClaimDetailsStepProps) {
  return (
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
          disabled={isPending}
          data-testid="button-submit-claim"
        >
          {isPending ? "Creating..." : "Create Incident"}
        </Button>
      </div>
    </div>
  );
}
