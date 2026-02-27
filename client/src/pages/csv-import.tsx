import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CLAIM_FIELDS = [
  { key: "proName", label: "Pro Name (Full — splits into First/Last)", required: false },
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "dateOfInjury", label: "Date of Injury", required: true },
  { key: "workerType", label: "Shift Type (W2/1099/CL)", required: true },
  { key: "partnerName", label: "Partner Name", required: true },
  { key: "tpaClaimId", label: "TPA Claim ID", required: false },
  { key: "proId", label: "Pro ID", required: false },
  { key: "dateSubmitted", label: "Date Submitted", required: false },
  { key: "dateEmployerNotified", label: "Date Employer Notified", required: false },
  { key: "dateClosed", label: "Date Closed", required: false },
  { key: "claimType", label: "Claim Type", required: false },
  { key: "claimStatus", label: "Claim Status", required: false },
  { key: "injuryType", label: "Injury Type", required: false },
  { key: "stateOfInjury", label: "State of Injury (2-letter)", required: false },
  { key: "shiftType", label: "Shift Type", required: false },
  { key: "litigated", label: "Litigated (true/false)", required: false },
  { key: "insuredName", label: "Insured Name", required: false },
  { key: "carrier", label: "Carrier", required: false },
  { key: "policyYear", label: "Policy Year", required: false },
  { key: "policyNumber", label: "Policy Number", required: false },
  { key: "tnsSpecialist", label: "T&S Specialist", required: false },
  { key: "adjuster", label: "Adjuster", required: false },
  { key: "applicantAttorney", label: "Applicant Attorney", required: false },
  { key: "defenseAttorney", label: "Defense Attorney", required: false },
  { key: "stage", label: "Stage (intake/active_claim/litigation/settled/closed)", required: false },
  { key: "tldr", label: "TL;DR Summary", required: false },
  { key: "nextSteps", label: "Next Steps", required: false },
  { key: "severityAndPrognosis", label: "Severity & Prognosis", required: false },
  { key: "totalPayments", label: "Total Payments", required: false },
  { key: "totalOutstanding", label: "Total Outstanding", required: false },
  { key: "medicalTotal", label: "Medical Total", required: false },
  { key: "incentiveAmount", label: "Incentive Amount", required: false },
  { key: "lossesPaid", label: "Losses Paid", required: false },
  { key: "lossAdjustingExpenses", label: "Loss Adjusting Expenses", required: false },
  { key: "temporaryDisability", label: "Temporary Disability (true/false)", required: false },
  { key: "permanentTotalDisability", label: "Permanent Total Disability (true/false)", required: false },
  { key: "mmi", label: "MMI (true/false)", required: false },
  { key: "impairmentRating", label: "Impairment Rating", required: false },
  { key: "settlementRecommendation", label: "Settlement Recommendation", required: false },
  { key: "settlementAuthority", label: "Settlement Authority", required: false },
  { key: "actualSettlementAmount", label: "Actual Settlement Amount", required: false },
  { key: "fnolFiled", label: "FNOL Filed (true/false)", required: false },
  { key: "froiFiled", label: "FROI Filed (true/false)", required: false },
  { key: "wageStatementSent", label: "Wage Statement Sent (true/false)", required: false },
  { key: "earningsStatementSent", label: "Earnings Statement Sent (true/false)", required: false },
  { key: "medicalPanelSent", label: "Medical Panel Sent (true/false)", required: false },
  { key: "paidFullShift", label: "Paid Full Shift (true/false)", required: false },
  { key: "intercomLink", label: "Intercom Link", required: false },
  { key: "shiftLink", label: "Shift Link", required: false },
  { key: "irLink", label: "Incident Report Link", required: false },
  { key: "medicalDocsLink", label: "Medical Docs Link", required: false },
];

const SKIP_VALUE = "__skip__";

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function autoMapColumn(header: string): string {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "");

  const mappings: Record<string, string> = {
    proname: "proName",
    "pro name": "proName",
    "pro_name": "proName",
    name: "proName",
    "full name": "proName",
    fullname: "proName",
    firstname: "firstName",
    first_name: "firstName",
    "first name": "firstName",
    lastname: "lastName",
    last_name: "lastName",
    "last name": "lastName",
    dateofinjury: "dateOfInjury",
    date_of_injury: "dateOfInjury",
    doi: "dateOfInjury",
    "injury date": "dateOfInjury",
    workertype: "workerType",
    worker_type: "workerType",
    "worker type": "workerType",
    shifttype: "workerType",
    shift_type: "workerType",
    "shift type": "workerType",
    type: "workerType",
    w21099: "workerType",
    "w2/1099": "workerType",
    "workers compensation": "workerType",
    "occupational accident": "workerType",
    "contingent liability": "workerType",
    partnername: "partnerName",
    partner_name: "partnerName",
    partner: "partnerName",
    client: "partnerName",
    tpaclaimid: "tpaClaimId",
    tpa_claim_id: "tpaClaimId",
    "tpa id": "tpaClaimId",
    "claim id": "tpaClaimId",
    claimid: "tpaClaimId",
    proid: "proId",
    pro_id: "proId",
    datesubmitted: "dateSubmitted",
    date_submitted: "dateSubmitted",
    "date submitted": "dateSubmitted",
    "submitted date": "dateSubmitted",
    claimtype: "claimType",
    claim_type: "claimType",
    "claim type": "claimType",
    claimstatus: "claimStatus",
    claim_status: "claimStatus",
    status: "claimStatus",
    injurytype: "injuryType",
    injury_type: "injuryType",
    "injury type": "injuryType",
    injury: "injuryType",
    stateofinjury: "stateOfInjury",
    state_of_injury: "stateOfInjury",
    state: "stateOfInjury",
    shift: "shiftType",
    litigated: "litigated",
    insuredname: "insuredName",
    insured_name: "insuredName",
    insured: "insuredName",
    carrier: "carrier",
    policyyear: "policyYear",
    policy_year: "policyYear",
    "policy year": "policyYear",
    policynumber: "policyNumber",
    policy_number: "policyNumber",
    "policy number": "policyNumber",
    "policy #": "policyNumber",
    tnsspecialist: "tnsSpecialist",
    tns_specialist: "tnsSpecialist",
    "tns specialist": "tnsSpecialist",
    "t&s specialist": "tnsSpecialist",
    "ts specialist": "tnsSpecialist",
    specialist: "tnsSpecialist",
    adjuster: "adjuster",
    applicantattorney: "applicantAttorney",
    applicant_attorney: "applicantAttorney",
    "applicant attorney": "applicantAttorney",
    aa: "applicantAttorney",
    defenseattorney: "defenseAttorney",
    defense_attorney: "defenseAttorney",
    "defense attorney": "defenseAttorney",
    da: "defenseAttorney",
    stage: "stage",
    tldr: "tldr",
    summary: "tldr",
    nextsteps: "nextSteps",
    next_steps: "nextSteps",
    "next steps": "nextSteps",
    totalpayments: "totalPayments",
    total_payments: "totalPayments",
    "total payments": "totalPayments",
    payments: "totalPayments",
    totaloutstanding: "totalOutstanding",
    total_outstanding: "totalOutstanding",
    "total outstanding": "totalOutstanding",
    outstanding: "totalOutstanding",
    medicaltotal: "medicalTotal",
    medical_total: "medicalTotal",
    "medical total": "medicalTotal",
    medical: "medicalTotal",
    fnolfiled: "fnolFiled",
    fnol: "fnolFiled",
    froifiled: "froiFiled",
    froi: "froiFiled",
  };

  const headerLower = header.toLowerCase().trim();
  if (mappings[headerLower]) return mappings[headerLower];
  if (mappings[normalized]) return mappings[normalized];

  const exactMatch = CLAIM_FIELDS.find(
    (f) => f.key.toLowerCase() === normalized || f.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized
  );
  if (exactMatch) return exactMatch.key;

  return SKIP_VALUE;
}

type ImportStep = "upload" | "map" | "preview" | "result";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function CsvImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please select a .csv file", variant: "destructive" });
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0 || rows.length === 0) {
        toast({ title: "Empty file", description: "The CSV file appears to be empty.", variant: "destructive" });
        return;
      }

      setCsvHeaders(headers);
      setCsvRows(rows);

      const autoMapping: Record<number, string> = {};
      headers.forEach((header, idx) => {
        autoMapping[idx] = autoMapColumn(header);
      });
      setColumnMapping(autoMapping);
      setStep("map");
    };
    reader.readAsText(file);
  }, [toast]);

  const mappedRows = csvRows.map((row) => {
    const obj: Record<string, string> = {};
    Object.entries(columnMapping).forEach(([colIdxStr, fieldKey]) => {
      if (fieldKey !== SKIP_VALUE) {
        const colIdx = parseInt(colIdxStr);
        const value = row[colIdx];
        if (value !== undefined && value !== "") {
          obj[fieldKey] = value;
        }
      }
    });
    return obj;
  });

  const mappedValues = Object.values(columnMapping);
  const hasProName = mappedValues.includes("proName");
  const hasFirstLast = mappedValues.includes("firstName") && mappedValues.includes("lastName");
  const requiredFieldsMapped =
    (hasProName || hasFirstLast) &&
    ["dateOfInjury", "workerType", "partnerName"].every((f) => mappedValues.includes(f));

  const importMutation = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const res = await apiRequest("POST", "/api/claims/bulk-import", { rows });
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/claims", "list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleImport = () => {
    importMutation.mutate(mappedRows);
  };

  const handleDownloadTemplate = () => {
    const requiredFields = CLAIM_FIELDS.filter((f) => f.required);
    const optionalFields = CLAIM_FIELDS.filter((f) => !f.required).slice(0, 15);
    const allFields = [...requiredFields, ...optionalFields];
    const headers = allFields.map((f) => f.key).join(",");
    const exampleRow = allFields.map((f) => {
      switch (f.key) {
        case "firstName": return "John";
        case "lastName": return "Doe";
        case "dateOfInjury": return "2025-01-15";
        case "workerType": return "W2";
        case "partnerName": return "Example Partner LLC";
        case "tpaClaimId": return "TPA-001";
        case "stateOfInjury": return "CA";
        case "injuryType": return "Fall/Slip/Trip";
        case "shiftType": return "Warehouse Associate";
        case "claimStatus": return "Open";
        case "claimType": return "Medical Only";
        case "stage": return "intake";
        case "carrier": return "WorkFirst";
        case "tnsSpecialist": return "Carlos";
        default: return "";
      }
    }).join(",");

    const csv = `${headers}\n${exampleRow}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "claims-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setStep("upload");
    setFileName("");
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/claims" data-testid="button-back-import">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold" data-testid="text-import-title">
              Import Claims from CSV
            </h1>
            <p className="text-xs text-muted-foreground">
              Upload a CSV file to bulk-create claim records
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-2 text-xs mb-6">
            {(["upload", "map", "preview", "result"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-6 bg-border" />}
                <div
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : ["upload", "map", "preview", "result"].indexOf(step) > i
                        ? "bg-muted text-foreground"
                        : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span className="font-mono text-[10px]">{i + 1}</span>
                  <span className="capitalize">{s === "map" ? "Map Columns" : s}</span>
                </div>
              </div>
            ))}
          </div>

          {step === "upload" && (
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="rounded-full bg-muted p-5">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Upload your CSV file</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                      Your CSV should have a header row with column names. The importer will
                      attempt to automatically map columns to claim fields. At minimum, you need:
                      first name, last name, date of injury, worker type, and partner name.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-choose-file"
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Choose CSV File
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownloadTemplate}
                      data-testid="button-download-template"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download Template
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-csv-file"
                  />

                  <div className="text-[10px] text-muted-foreground pt-2 space-y-0.5">
                    <p>Accepted format: .csv (comma-separated values)</p>
                    <p>Maximum recommended: 5,000 rows per import</p>
                    <p>Date format: YYYY-MM-DD (e.g. 2025-03-15)</p>
                    <p>Boolean fields: true/false, yes/no, 1/0, or x</p>
                    <p>Currency fields: can include $ and commas (e.g. $1,500.00)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "map" && (
            <>
              <Card>
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Map Columns</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fileName} &mdash; {csvRows.length} rows, {csvHeaders.length} columns detected.
                      Map each CSV column to a claim field. Use "Pro Name" for a combined name column — it will auto-split into first/last. Shift type accepts W2, 1099, CL, Workers Compensation, Occupational Accident, or Contingent Liability.
                    </p>
                  </div>
                  {!requiredFieldsMapped && (
                    <Badge variant="destructive" className="text-[10px]">
                      Missing required mappings
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {csvHeaders.map((header, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center py-1"
                        >
                          <div className="text-xs">
                            <span className="font-mono text-muted-foreground mr-2">{idx + 1}.</span>
                            <span className="font-medium">{header}</span>
                            {csvRows[0]?.[idx] && (
                              <span className="ml-2 text-muted-foreground text-[10px]">
                                e.g. "{csvRows[0][idx].slice(0, 30)}{csvRows[0][idx].length > 30 ? "..." : ""}"
                              </span>
                            )}
                          </div>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Select
                            value={columnMapping[idx] || SKIP_VALUE}
                            onValueChange={(v) =>
                              setColumnMapping((prev) => ({ ...prev, [idx]: v }))
                            }
                          >
                            <SelectTrigger
                              className={`h-7 text-xs ${
                                columnMapping[idx] === SKIP_VALUE
                                  ? "text-muted-foreground"
                                  : ""
                              }`}
                              data-testid={`select-map-${idx}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SKIP_VALUE}>
                                -- Skip this column --
                              </SelectItem>
                              {CLAIM_FIELDS.map((f) => (
                                <SelectItem key={f.key} value={f.key}>
                                  {f.label} {f.required ? "*" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={handleReset}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep("preview")}
                  disabled={!requiredFieldsMapped}
                  data-testid="button-continue-preview"
                >
                  Continue to Preview
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-sm font-semibold">Preview Import</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Showing first {Math.min(mappedRows.length, 10)} of {mappedRows.length} rows.
                    Review the data before importing.
                  </p>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[10px] uppercase">
                          <TableHead className="w-[40px]">#</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>DOI</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Partner</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Stage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappedRows.slice(0, 10).map((row, idx) => (
                          <TableRow key={idx} className="text-xs">
                            <TableCell className="text-muted-foreground font-mono">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {row.proName ? row.proName : `${row.firstName || ""} ${row.lastName || ""}`}
                            </TableCell>
                            <TableCell>{row.dateOfInjury || "-"}</TableCell>
                            <TableCell>{row.workerType || "-"}</TableCell>
                            <TableCell className="truncate max-w-[150px]">
                              {row.partnerName || "-"}
                            </TableCell>
                            <TableCell>{row.stateOfInjury || "-"}</TableCell>
                            <TableCell>{row.claimStatus || "Open"}</TableCell>
                            <TableCell>{row.stage || "intake"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  {mappedRows.length > 10 && (
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      ...and {mappedRows.length - 10} more rows
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={() => setStep("map")}>
                  Back to Mapping
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                  data-testid="button-run-import"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Importing {mappedRows.length} claims...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Import {mappedRows.length} Claims
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === "result" && importResult && (
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center space-y-4">
                  {importResult.imported > 0 ? (
                    <div className="rounded-full bg-green-100 p-4">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-red-100 p-4">
                      <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-semibold">Import Complete</h3>
                    <div className="flex items-center justify-center gap-4 mt-2">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600" data-testid="text-imported-count">
                          {importResult.imported}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">Imported</p>
                      </div>
                      {importResult.skipped > 0 && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-orange-600" data-testid="text-skipped-count">
                            {importResult.skipped}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">Skipped</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="w-full max-w-lg text-left">
                      <p className="text-xs font-medium text-red-600 mb-1">
                        Errors ({importResult.errors.length})
                      </p>
                      <ScrollArea className="max-h-[200px] rounded-md border bg-muted/50 p-3">
                        {importResult.errors.map((err, i) => (
                          <p key={i} className="text-[10px] text-muted-foreground py-0.5">
                            {err}
                          </p>
                        ))}
                      </ScrollArea>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={handleReset} data-testid="button-import-another">
                      Import Another File
                    </Button>
                    <Button asChild data-testid="button-view-claims-after-import">
                      <Link href="/claims">View All Claims</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
