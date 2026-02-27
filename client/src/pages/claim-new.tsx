import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { insertClaimSchema } from "@shared/schema";
import { z } from "zod";

const formSchema = insertClaimSchema
  .pick({
    firstName: true,
    lastName: true,
    dateOfInjury: true,
    workerType: true,
    partnerName: true,
    stateOfInjury: true,
    injuryType: true,
    shiftType: true,
    tnsSpecialist: true,
    proId: true,
    dateSubmitted: true,
    insuredName: true,
    carrier: true,
    claimType: true,
  })
  .extend({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    dateOfInjury: z.string().min(1, "Date of injury is required"),
    workerType: z.enum(["W2", "1099", "CL"]),
    partnerName: z.string().min(1, "Partner name is required"),
  });

type FormValues = z.infer<typeof formSchema>;

const INJURY_TYPES = [
  "Fall/Slip/Trip",
  "Contusion",
  "Cut/Laceration",
  "Strain: Repetitive movement",
  "Strain: Lifting",
  "Falling Object",
  "Burn",
  "Motor Vehicle Accident",
  "Chemical Exposure",
  "Other",
];

const SHIFT_TYPES = [
  "Warehouse Associate",
  "Event Server",
  "Custodial",
  "Dishwasher",
  "Prep Cook",
  "General Labor",
  "Bartender",
  "Banquet Server",
  "Line Cook",
  "Other",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function ClaimNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfInjury: "",
      workerType: "W2",
      partnerName: "",
      stateOfInjury: "",
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

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/claims", {
        ...data,
        stage: "intake",
        claimStatus: "Open",
      });
      return res.json();
    },
    onSuccess: (claim) => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", "list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Claim created", description: `Claim #${claim.id} has been created.` });
      navigate(`/claims/${claim.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error creating claim",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/claims" data-testid="button-back-new">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-new-claim-title">
              New Claim
            </h1>
            <p className="text-xs text-muted-foreground">
              Injury intake form for Trust & Safety
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="max-w-3xl space-y-4"
          >
            <Card>
              <CardHeader className="p-4 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Claimant Information *
                </h3>
              </CardHeader>
              <CardContent className="p-4 pt-2 grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">First Name *</FormLabel>
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
                      <FormLabel className="text-xs">Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-8 text-sm" data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="proId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Pro ID</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-8 text-sm" data-testid="input-pro-id" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOfInjury"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Date of Injury *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-8 text-sm" data-testid="input-date-injury" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Classification
                </h3>
              </CardHeader>
              <CardContent className="p-4 pt-2 grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="workerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Worker Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm" data-testid="select-worker-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="W2">W2</SelectItem>
                          <SelectItem value="1099">1099</SelectItem>
                          <SelectItem value="CL">CL (Cross-over/Late)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="claimType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Claim Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "Pending"}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm" data-testid="select-claim-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["Pending", "Medical Only", "Other Than Medical Only", "Incident Only", "Incident Only W2", "Incident Only 1099"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stateOfInjury"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">State of Injury *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm" data-testid="select-state">
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
                <FormField
                  control={form.control}
                  name="injuryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Injury Type *</FormLabel>
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
                <FormField
                  control={form.control}
                  name="shiftType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Shift Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm" data-testid="select-shift-type">
                            <SelectValue placeholder="Select shift" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SHIFT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Partner & Assignment
                </h3>
              </CardHeader>
              <CardContent className="p-4 pt-2 grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="partnerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Partner Name *</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-8 text-sm" placeholder="e.g. Phoenix Convention Center" data-testid="input-partner" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insuredName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Insured Name</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-8 text-sm" data-testid="input-insured" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="carrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Carrier</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-8 text-sm" placeholder="e.g. WorkFirst, Great American" data-testid="input-carrier" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tnsSpecialist"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">T&S Specialist</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-8 text-sm" data-testid="input-tns-specialist" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateSubmitted"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Date Submitted</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-8 text-sm" data-testid="input-date-submitted" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" type="button" asChild>
                <Link href="/claims">Cancel</Link>
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-claim"
              >
                {createMutation.isPending ? "Creating..." : "Create Claim"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
