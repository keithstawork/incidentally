import { User, Briefcase, FileText } from "lucide-react";
import { insertClaimSchema } from "@shared/schema";
import { z } from "zod";

export interface ProShift {
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

export function extractStateCode(regionName: string | null): string | null {
  if (!regionName) return null;
  const match = regionName.match(/,\s*([A-Z]{2})/);
  return match ? match[1] : null;
}

export function shiftDate(shift: ProShift): string | null {
  if (!shift.startsAt) return null;
  return shift.startsAt.slice(0, 10);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetween(a: string, b: string): number {
  const msA = new Date(a + "T00:00:00").getTime();
  const msB = new Date(b + "T00:00:00").getTime();
  return Math.round((msA - msB) / 86_400_000);
}

export const formSchema = insertClaimSchema
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

export type FormValues = z.infer<typeof formSchema>;

export const SHIFT_POSITIONS = [
  "Banquet Server", "Barista", "Bartender", "Catering Server",
  "Custodial", "Dishwasher", "Event Server", "Event Staff",
  "Food Runner", "Forklift Operator", "Front Desk",
  "General Labor", "Housekeeper", "Line Cook", "Prep Cook",
  "Security Guard", "Warehouse Associate", "Other",
];

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export const STEP_ICONS = [User, Briefcase, FileText];

export const STEP_LABELS = [
  "Injured Worker & Date of Injury",
  "Shift Details",
  "Claim Details",
];
