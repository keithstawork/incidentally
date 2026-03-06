import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUSES, INJURY_TYPES, CLAIM_TYPES } from "@/lib/constants";
import { formatCurrency } from "@/lib/formatters";
import { FieldRow, ProStatusBadge } from "./helpers";
import type { Claim, Pro } from "@shared/schema";

interface OverviewTabProps {
  claim: Claim;
  pro: Pro | undefined;
  applicablePolicy: { policy: any | null; coverageType: string; coverageNote: string } | undefined;
  isEditing: boolean;
  getEditValue: (field: string) => any;
  setEditValue: (field: string, value: any) => void;
  showLitigationFields: boolean;
  totalIncurred: number;
  settlementSavings: number | null;
  updateMutation: { isPending: boolean; mutate: (data: Record<string, any>) => void };
}

export function OverviewTab({
  claim,
  pro,
  applicablePolicy,
  isEditing,
  getEditValue,
  setEditValue,
  showLitigationFields,
  totalIncurred,
  settlementSavings,
  updateMutation,
}: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pro Details
              </h3>
              <ProStatusBadge status={pro?.workerStatus} />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-0.5">
            <FieldRow label="First Name">
              {isEditing ? (
                <Input className="h-7 text-xs" value={getEditValue("firstName")} onChange={(e) => setEditValue("firstName", e.target.value)} />
              ) : claim.firstName}
            </FieldRow>
            <FieldRow label="Last Name">
              {isEditing ? (
                <Input className="h-7 text-xs" value={getEditValue("lastName")} onChange={(e) => setEditValue("lastName", e.target.value)} />
              ) : claim.lastName}
            </FieldRow>
            <FieldRow label="Pro ID">
              {claim.proId ? (
                <a href={`https://admin.instawork.com/internal/falcon/${claim.proId}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                  <ExternalLink className="h-3 w-3" /> {claim.proId}
                </a>
              ) : "-"}
            </FieldRow>
            <FieldRow label="Email">{pro?.email || "-"}</FieldRow>
            <FieldRow label="Phone">{pro?.phone || "-"}</FieldRow>
            <FieldRow label="Address">{pro?.address || "-"}</FieldRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shift Details
            </h3>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-0.5">
            <FieldRow label="Partner">{claim.partnerName || "-"}</FieldRow>
            <FieldRow label="Partner Address">{claim.shiftLocation || "-"}</FieldRow>
            <FieldRow label="Shift ID">
              {claim.shiftLink ? (() => {
                const m = claim.shiftLink!.match(/\/shift\/([^/]+)/);
                const shiftId = m ? m[1] : null;
                return (
                  <a href={claim.shiftLink!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                    <ExternalLink className="h-3 w-3" /> {shiftId || "View shift"}
                  </a>
                );
              })() : "-"}
            </FieldRow>
            <FieldRow label="Shift Type">{claim.workerType || "-"}</FieldRow>
            <FieldRow label="Position">{claim.shiftType || "-"}</FieldRow>
            <FieldRow label="Pay Rate">{claim.payRate ? `$${parseFloat(claim.payRate).toFixed(2)}/hr` : "-"}</FieldRow>
            <FieldRow label="Shift Length">{claim.shiftLengthHours ? `${parseFloat(claim.shiftLengthHours).toFixed(1)} hrs` : "-"}</FieldRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Insurance Details
            </h3>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-0.5">
            {applicablePolicy ? (
              <>
                <FieldRow label="Claim #">{claim.tpaClaimId || <span className="text-muted-foreground">Not yet assigned</span>}</FieldRow>
                <FieldRow label="Coverage Type">
                  <span className="font-medium">{applicablePolicy.coverageType}</span>
                </FieldRow>
                {applicablePolicy.policy ? (
                  <>
                    <FieldRow label="Carrier">{applicablePolicy.policy.carrierName}</FieldRow>
                    {applicablePolicy.policy.policyNumber && (
                      <FieldRow label="Policy #">{applicablePolicy.policy.policyNumber}</FieldRow>
                    )}
                    <FieldRow label="Policy Period">
                      {applicablePolicy.policy.policyYearStart && applicablePolicy.policy.policyYearEnd
                        ? `${new Date(applicablePolicy.policy.policyYearStart).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${new Date(applicablePolicy.policy.policyYearEnd).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                        : "-"}
                    </FieldRow>
                    <FieldRow label="Insured Party">{applicablePolicy.policy.insuredParty || "-"}</FieldRow>
                    {applicablePolicy.policy.notes && (
                      <FieldRow label="Coverage Details">
                        <span className="text-muted-foreground italic">{applicablePolicy.policy.notes}</span>
                      </FieldRow>
                    )}
                  </>
                ) : (
                  <FieldRow label="Policy">
                    <span className="text-[#C4A27F] text-[10px]">No matching policy found for this date of injury</span>
                  </FieldRow>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Determining coverage...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Incident Details
            </h3>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-0.5">
            <FieldRow label="Status">
              {isEditing ? (
                <Select value={getEditValue("claimStatus") || ""} onValueChange={(v) => setEditValue("claimStatus", v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              ) : claim.claimStatus || "-"}
            </FieldRow>
            <FieldRow label="Injury Type">
              {isEditing ? (
                <Select value={getEditValue("injuryType") || ""} onValueChange={(v) => setEditValue("injuryType", v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {INJURY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : claim.injuryType || "-"}
            </FieldRow>
            <FieldRow label="Claim Type">
              {isEditing ? (
                <Select value={getEditValue("claimType") || ""} onValueChange={(v) => setEditValue("claimType", v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLAIM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : claim.claimType || "-"}
            </FieldRow>
            <FieldRow label="Litigated">{claim.litigated ? "Yes" : "No"}</FieldRow>
            <Separator className="my-1.5" />
            <FieldRow label="T&S Agent">{claim.tnsSpecialist || "-"}</FieldRow>
            <FieldRow label="Adjuster">
              {isEditing ? (
                <Input className="h-7 text-xs" value={getEditValue("adjuster") || ""} onChange={(e) => setEditValue("adjuster", e.target.value)} />
              ) : claim.adjuster || "-"}
            </FieldRow>
            {showLitigationFields && (
              <>
                <FieldRow label="Applicant Attorney">{claim.applicantAttorney || "-"}</FieldRow>
                <FieldRow label="Defense Attorney">{claim.defenseAttorney || "-"}</FieldRow>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Financials
            </h3>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-0.5">
            <FieldRow label="Total Payments">{formatCurrency(claim.totalPayments)}</FieldRow>
            <FieldRow label="Total Outstanding">{formatCurrency(claim.totalOutstanding)}</FieldRow>
            <FieldRow label="Total Incurred">
              <span className="font-semibold">{formatCurrency(totalIncurred.toString())}</span>
            </FieldRow>
            <FieldRow label="Medical Total">{formatCurrency(claim.medicalTotal)}</FieldRow>
            <FieldRow label="Losses Paid">{formatCurrency(claim.lossesPaid)}</FieldRow>
            <FieldRow label="Loss Adjusting Expenses">{formatCurrency(claim.lossAdjustingExpenses)}</FieldRow>
            <FieldRow label="Incentive Amount">{formatCurrency(claim.incentiveAmount)}</FieldRow>
            <FieldRow label="Temp Disability">{claim.temporaryDisability ? "Yes" : "No"}</FieldRow>
            <FieldRow label="Perm Total Disability">{claim.permanentTotalDisability ? "Yes" : "No"}</FieldRow>
            <FieldRow label="MMI">{claim.mmi ? "Yes" : "No"}</FieldRow>
            <FieldRow label="Impairment Rating">{claim.impairmentRating || "-"}</FieldRow>
            {showLitigationFields && (
              <>
                <Separator className="my-1.5" />
                <FieldRow label="Settlement Rec.">{formatCurrency(claim.settlementRecommendation)}</FieldRow>
                <FieldRow label="Settlement Authority">{formatCurrency(claim.settlementAuthority)}</FieldRow>
                <FieldRow label="Actual Settlement">{formatCurrency(claim.actualSettlementAmount)}</FieldRow>
                {settlementSavings !== null && (
                  <FieldRow label="Settlement Savings">
                    <span className={settlementSavings >= 0 ? "text-[#3B5747]" : "text-[#EC5A53]"}>
                      {formatCurrency(settlementSavings.toString())}
                    </span>
                  </FieldRow>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {(claim.intercomLink || claim.shiftLink || claim.irLink || claim.medicalDocsLink) && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              External Links
            </h3>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {claim.intercomLink && (
                <a href={claim.intercomLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Intercom
                </a>
              )}
              {claim.shiftLink && (
                <a href={claim.shiftLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Shift
                </a>
              )}
              {claim.irLink && (
                <a href={claim.irLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Incident Report
                </a>
              )}
              {claim.medicalDocsLink && (
                <a href={claim.medicalDocsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Medical Docs
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
