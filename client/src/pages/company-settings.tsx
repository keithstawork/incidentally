import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Building2, Plus, Pencil, Trash2, Shield, ChevronRight, ChevronDown, X, Check, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company, InsurancePolicy } from "@shared/schema";

const POLICY_TYPES = [
  "Canadian Package", "Crime", "Crime / D&O / Fiduciary",
  "Directors & Officers", "Employed Lawyers PL",
  "Employment Practices Liability", "Excess Liability",
  "Foreign Package", "General Liability", "Hired & Non-Owned Auto",
  "Occupational Accident", "Property", "Staffing E&O",
  "Tech E&O / Cyber", "Umbrella", "Workers Comp", "Other",
];

interface PolicyForm {
  carrierName: string;
  policyType: string;
  policyNumber: string;
  policyYearStart: string;
  policyYearEnd: string;
  insuredParty: string;
  status: "Active" | "Expired";
  notes: string;
}

const emptyPolicyForm: PolicyForm = {
  carrierName: "",
  policyType: "",
  policyNumber: "",
  policyYearStart: "",
  policyYearEnd: "",
  insuredParty: "",
  status: "Active",
  notes: "",
};

export default function CompanySettings() {
  const { toast } = useToast();

  const { data: companiesData = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  const { data: policies = [] } = useQuery<InsurancePolicy[]>({
    queryKey: ["/api/policies"],
  });

  // --- Company state ---
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);

  // --- Policy state ---
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);
  const [policyForm, setPolicyForm] = useState<PolicyForm>(emptyPolicyForm);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  const toggleHistory = (type: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const parent = companiesData.find((c) => c.type === "parent");
  const subsidiaries = companiesData.filter((c) => c.type === "subsidiary");

  // --- Mutations ---

  const createCompany = useMutation({
    mutationFn: async (data: { name: string; type: "parent" | "subsidiary"; parentId?: number }) => {
      const res = await apiRequest("POST", "/api/companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setNewCompanyName("");
      setShowAddCompany(false);
      toast({ title: "Company added" });
    },
  });

  const updateCompany = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `/api/companies/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setEditingCompanyId(null);
      toast({ title: "Company updated" });
    },
  });

  const deleteCompany = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company removed" });
    },
  });

  const createPolicy = useMutation({
    mutationFn: async (data: PolicyForm) => {
      const res = await apiRequest("POST", "/api/policies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      setPolicyForm(emptyPolicyForm);
      setShowAddPolicy(false);
      toast({ title: "Policy added" });
    },
  });

  const updatePolicy = useMutation({
    mutationFn: async ({ id, ...data }: PolicyForm & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/policies/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      setEditingPolicyId(null);
      toast({ title: "Policy updated" });
    },
  });

  const deletePolicy = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/policies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      toast({ title: "Policy removed" });
    },
  });

  function startEditPolicy(p: InsurancePolicy) {
    setEditingPolicyId(p.id);
    setPolicyForm({
      carrierName: p.carrierName,
      policyType: p.policyType,
      policyNumber: p.policyNumber || "",
      policyYearStart: p.policyYearStart || "",
      policyYearEnd: p.policyYearEnd || "",
      insuredParty: p.insuredParty || "",
      status: p.status as "Active" | "Expired",
      notes: (p as any).notes || "",
    });
  }

  function renderPolicyFormFields() {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Carrier Name *</label>
            <Input
              className="h-8 text-sm mt-0.5"
              value={policyForm.carrierName}
              onChange={(e) => setPolicyForm({ ...policyForm, carrierName: e.target.value })}
              placeholder="e.g. Work First"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Policy Type *</label>
            <Select value={policyForm.policyType} onValueChange={(v) => setPolicyForm({ ...policyForm, policyType: v })}>
              <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {POLICY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Policy Number</label>
            <Input
              className="h-8 text-sm mt-0.5"
              value={policyForm.policyNumber}
              onChange={(e) => setPolicyForm({ ...policyForm, policyNumber: e.target.value })}
              placeholder="e.g. WC-2024-001"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Policy Year Start</label>
            <Input
              type="date"
              className="h-8 text-sm mt-0.5"
              value={policyForm.policyYearStart}
              onChange={(e) => setPolicyForm({ ...policyForm, policyYearStart: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Policy Year End</label>
            <Input
              type="date"
              className="h-8 text-sm mt-0.5"
              value={policyForm.policyYearEnd}
              onChange={(e) => setPolicyForm({ ...policyForm, policyYearEnd: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Insured Party</label>
            <Input
              className="h-8 text-sm mt-0.5"
              value={policyForm.insuredParty}
              onChange={(e) => setPolicyForm({ ...policyForm, insuredParty: e.target.value })}
              placeholder="e.g. Advantage Workforce Services, LLC"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</label>
            <Select value={policyForm.status} onValueChange={(v) => setPolicyForm({ ...policyForm, status: v as "Active" | "Expired" })}>
              <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Notes</label>
          <Input
            className="h-8 text-sm mt-0.5"
            value={policyForm.notes}
            onChange={(e) => setPolicyForm({ ...policyForm, notes: e.target.value })}
            placeholder="Coverage details, limits, deductibles..."
          />
        </div>
      </div>
    );
  }

  const activePolicies = policies.filter((p) => p.status === "Active");

  const historyByType = policies.reduce((acc, p) => {
    if (p.status === "Expired") {
      if (!acc[p.policyType]) acc[p.policyType] = [];
      acc[p.policyType].push(p);
    }
    return acc;
  }, {} as Record<string, InsurancePolicy[]>);

  const historyTypes = Object.keys(historyByType).sort();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-3">
        <h1 className="text-lg font-semibold">Company Settings</h1>
        <p className="text-xs text-muted-foreground">Corporate structure and insurance policies</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">

          {/* === Corporate Structure === */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Corporate Structure
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowAddCompany(true)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-1">
              {/* Parent */}
              {parent && (
                <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/40">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  {editingCompanyId === parent.id ? (
                    <>
                      <Input
                        className="h-7 text-sm flex-1"
                        value={editingCompanyName}
                        onChange={(e) => setEditingCompanyName(e.target.value)}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateCompany.mutate({ id: parent.id, name: editingCompanyName })}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingCompanyId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium flex-1">{parent.name}</span>
                      <Badge variant="outline" className="text-[10px]">Parent</Badge>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-50 hover:opacity-100" onClick={() => { setEditingCompanyId(parent.id); setEditingCompanyName(parent.name); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Subsidiaries */}
              {subsidiaries.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 py-1.5 px-2 pl-8 rounded-md hover:bg-muted/30">
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  {editingCompanyId === sub.id ? (
                    <>
                      <Input
                        className="h-7 text-sm flex-1"
                        value={editingCompanyName}
                        onChange={(e) => setEditingCompanyName(e.target.value)}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateCompany.mutate({ id: sub.id, name: editingCompanyName })}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingCompanyId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1">{sub.name}</span>
                      <Badge variant="secondary" className="text-[10px]">Subsidiary</Badge>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-50 hover:opacity-100" onClick={() => { setEditingCompanyId(sub.id); setEditingCompanyName(sub.name); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-50 hover:opacity-100 text-destructive" onClick={() => deleteCompany.mutate(sub.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}

              {/* Add company form */}
              {showAddCompany && (
                <div className="flex items-center gap-2 py-1.5 px-2 pl-8 rounded-md border border-dashed">
                  <Input
                    className="h-7 text-sm flex-1"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Company name"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!newCompanyName.trim()}
                    onClick={() => createCompany.mutate({ name: newCompanyName.trim(), type: "subsidiary", parentId: parent?.id })}
                  >
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setShowAddCompany(false); setNewCompanyName(""); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* === Insurance Policies === */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Insurance Policies
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setShowAddPolicy(true); setPolicyForm(emptyPolicyForm); setEditingPolicyId(null); }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Policy
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">

              {/* Add policy form */}
              {showAddPolicy && !editingPolicyId && (
                <div className="rounded-md border border-dashed p-3 space-y-3">
                  <p className="text-xs font-medium">New Policy</p>
                  {renderPolicyFormFields()}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddPolicy(false)}>Cancel</Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!policyForm.carrierName || !policyForm.policyType}
                      onClick={() => createPolicy.mutate(policyForm)}
                    >
                      Add Policy
                    </Button>
                  </div>
                </div>
              )}

              {/* Active Policies */}
              {activePolicies.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Current Coverage ({activePolicies.length})
                  </p>
                  <div className="space-y-2">
                    {activePolicies.map((p) => renderPolicyRow(p))}
                  </div>
                </div>
              )}

              {/* Policy History by type */}
              {historyTypes.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Policy History
                  </p>
                  <div className="space-y-1">
                    {historyTypes.map((type) => {
                      const group = historyByType[type];
                      const isOpen = expandedHistory.has(type);
                      return (
                        <div key={type}>
                          <button
                            className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
                            onClick={() => toggleHistory(type)}
                          >
                            {isOpen
                              ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                              : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            }
                            <History className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-sm">{type}</span>
                            <span className="text-[10px] text-muted-foreground ml-auto">{group.length} prior</span>
                          </button>
                          {isOpen && (
                            <div className="space-y-2 pl-4 mt-1 mb-2">
                              {group.map((p) => renderPolicyRow(p))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {policies.length === 0 && !showAddPolicy && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No insurance policies configured yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  function renderPolicyRow(p: InsurancePolicy) {
    if (editingPolicyId === p.id) {
      return (
        <div key={p.id} className="rounded-md border p-3 space-y-3">
          {renderPolicyFormFields()}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingPolicyId(null)}>Cancel</Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!policyForm.carrierName || !policyForm.policyType}
              onClick={() => updatePolicy.mutate({ id: p.id, ...policyForm })}
            >
              Save
            </Button>
          </div>
        </div>
      );
    }

    const fmtDate = (d: string) => {
      const [y, m] = d.split("-");
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${months[parseInt(m) - 1]} ${parseInt(y)}`;
    };
    const yearRange = p.policyYearStart && p.policyYearEnd
      ? `${fmtDate(p.policyYearStart)} – ${fmtDate(p.policyYearEnd)}`
      : p.policyYearStart ? fmtDate(p.policyYearStart) : p.policyYearEnd ? fmtDate(p.policyYearEnd) : "—";

    return (
      <div key={p.id} className="flex items-start gap-3 rounded-md border px-3 py-2 group">
        <Shield className={`h-4 w-4 mt-0.5 shrink-0 ${p.status === "Active" ? "text-[#3B5747]" : "text-muted-foreground"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{p.carrierName}</span>
            <Badge variant={p.status === "Active" ? "default" : "secondary"} className="text-[10px]">
              {p.policyType}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
            {p.policyNumber && <span>No. {p.policyNumber}</span>}
            <span>{yearRange}</span>
            {p.insuredParty && <span>Insured: {p.insuredParty}</span>}
          </div>
          {(p as any).notes && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{(p as any).notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditPolicy(p)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deletePolicy.mutate(p.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }
}
