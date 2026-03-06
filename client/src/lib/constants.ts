export const INJURY_TYPES = [
  "Burn", "Chemical Exposure", "Contusion", "Cut/Laceration",
  "Fall/Slip/Trip", "Falling Object", "Motor Vehicle Accident",
  "Strain: Lifting", "Strain: Repetitive movement", "Other",
] as const;

export const STAGES = ["intake", "active_claim", "litigation", "settled", "closed"] as const;

export const STATUSES = ["Closed", "Denied", "Incident Only", "Incident Report", "Open"] as const;

export const CLAIM_TYPES = [
  "Incident Only", "Incident Only 1099", "Incident Only W2",
  "Medical Only", "Other Than Medical Only", "Pending",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  intake: "Intake",
  active_claim: "Active Claim",
  litigation: "Litigation",
  settled: "Settled",
  closed: "Closed",
};

export const STATUS_BADGE_VARIANTS: Record<string, string> = {
  Open: "bg-[#C4A27F]/15 text-[#76614C] border-[#C4A27F]/30",
  Closed: "bg-[#3B5747]/15 text-[#23342B] border-[#3B5747]/30",
  Denied: "bg-[#EC5A53]/15 text-[#8E3632] border-[#EC5A53]/30",
  "Incident Only": "bg-[#576270]/10 text-[#576270] border-[#576270]/20",
  "Incident Report": "bg-[#576270]/10 text-[#576270] border-[#576270]/20",
};

export const STAGE_BADGE_VARIANTS: Record<string, string> = {
  intake: "bg-[#294EB2]/15 text-[#192F6B] border-[#294EB2]/30",
  active_claim: "bg-[#3B5747]/15 text-[#23342B] border-[#3B5747]/30",
  litigation: "bg-[#EC5A53]/15 text-[#8E3632] border-[#EC5A53]/30",
  settled: "bg-[#C4A27F]/15 text-[#76614C] border-[#C4A27F]/30",
  closed: "bg-[#576270]/10 text-[#576270] border-[#576270]/20",
};

export const STATUS_COLORS: Record<string, string> = {
  Open: "#C4A27F",
  Closed: "#3B5747",
  Denied: "#EC5A53",
  "Incident Only": "#576270",
  "Incident Report": "#576270",
  "Not reported/Incident only 1099": "#576270",
};

export const NOTE_TYPE_LABELS: Record<string, string> = {
  action_item_adjuster: "Action Item - Adjuster",
  action_item_aws: "Action Item - AWS",
  action_item_legal: "Action Item - Legal",
  email_thread: "Email Thread",
  general_note: "General Note",
  status_change: "Status Change",
  update: "Update",
};
