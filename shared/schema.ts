export * from "./models/auth";

import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  date,
  decimal,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export const workerTypeEnum = pgEnum("worker_type", ["W2", "1099", "CL"]);

export const claimTypeEnum = pgEnum("claim_type", [
  "Medical Only",
  "Other Than Medical Only",
  "Incident Only",
  "Incident Only W2",
  "Incident Only 1099",
  "Accidental Medical Expense",
  "Indemnity",
  "Indemnity & Medical",
  "Pending",
]);

export const claimStatusEnum = pgEnum("claim_status", [
  "Open",
  "Closed",
  "Denied",
  "Incident Only",
  "Incident Report",
  "Not reported/Incident only 1099",
]);

export const stageEnum = pgEnum("stage", [
  "intake",
  "active_claim",
  "litigation",
  "settled",
  "closed",
]);

export const noteTypeEnum = pgEnum("note_type", [
  "update",
  "action_item_adjuster",
  "action_item_aws",
  "action_item_legal",
  "general_note",
  "email_thread",
  "status_change",
]);

export const userRoleEnum = pgEnum("user_role", [
  "trust_and_safety",
  "legal",
  "admin",
]);

export const claims = pgTable("claims", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  matterNumber: varchar("matter_number", { length: 30 }),
  tpaClaimId: varchar("tpa_claim_id", { length: 100 }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  middleName: varchar("middle_name", { length: 200 }),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  suffix: varchar("suffix", { length: 50 }),
  preferredName: varchar("preferred_name", { length: 100 }),
  nameAliases: text("name_aliases").array(),
  proId: varchar("pro_id", { length: 100 }),
  dateOfInjury: date("date_of_injury").notNull(),
  dateSubmitted: date("date_submitted"),
  dateEmployerNotified: date("date_employer_notified"),
  dateClosed: date("date_closed"),

  workerType: workerTypeEnum("worker_type").notNull(),
  claimType: claimTypeEnum("claim_type").default("Pending"),
  claimStatus: claimStatusEnum("claim_status").default("Open"),
  injuryType: varchar("injury_type", { length: 200 }),
  stateOfInjury: varchar("state_of_injury", { length: 2 }),
  shiftType: varchar("shift_type", { length: 200 }),
  litigated: boolean("litigated").default(false),

  partnerName: varchar("partner_name", { length: 300 }).notNull(),
  partnerState: varchar("partner_state", { length: 2 }),
  shiftLocation: varchar("shift_location", { length: 500 }),
  payRate: decimal("pay_rate", { precision: 8, scale: 2 }),
  shiftLengthHours: decimal("shift_length_hours", { precision: 5, scale: 2 }),
  insuredName: varchar("insured_name", { length: 300 }),
  carrier: varchar("carrier", { length: 200 }),
  policyYear: varchar("policy_year", { length: 10 }),
  policyNumber: varchar("policy_number", { length: 100 }),

  tnsSpecialist: varchar("tns_specialist", { length: 100 }),
  adjuster: varchar("adjuster", { length: 200 }),
  applicantAttorney: varchar("applicant_attorney", { length: 200 }),
  defenseAttorney: varchar("defense_attorney", { length: 200 }),

  stage: stageEnum("stage").default("intake").notNull(),

  tldr: text("tldr"),
  nextSteps: text("next_steps"),
  severityAndPrognosis: text("severity_and_prognosis"),
  futureMedicalExpense: text("future_medical_expense"),
  pathway: text("pathway"),
  pathwaySteps: text("pathway_steps"),
  pathwayWhenToUse: text("pathway_when_to_use"),

  totalPayments: decimal("total_payments", { precision: 12, scale: 2 }).default("0"),
  totalOutstanding: decimal("total_outstanding", { precision: 12, scale: 2 }).default("0"),
  incentiveAmount: decimal("incentive_amount", { precision: 12, scale: 2 }),
  medicalTotal: decimal("medical_total", { precision: 12, scale: 2 }),
  temporaryDisability: boolean("temporary_disability").default(false),
  lossesPaid: decimal("losses_paid", { precision: 12, scale: 2 }),
  permanentTotalDisability: boolean("permanent_total_disability").default(false),
  lossAdjustingExpenses: decimal("loss_adjusting_expenses", { precision: 12, scale: 2 }),
  mmi: boolean("mmi").default(false),
  impairmentRating: varchar("impairment_rating", { length: 50 }),
  settlementRecommendation: decimal("settlement_recommendation", { precision: 12, scale: 2 }),
  settlementAuthority: decimal("settlement_authority", { precision: 12, scale: 2 }),
  actualSettlementAmount: decimal("actual_settlement_amount", { precision: 12, scale: 2 }),

  medicalPanelSent: boolean("medical_panel_sent").default(false),
  mpnDwc7Sent: boolean("mpn_dwc7_sent").default(false),
  billOfRightsSent: boolean("bill_of_rights_sent").default(false),
  paidFullShift: boolean("paid_full_shift").default(false),
  payIssuedViaIncentiveAdp: boolean("pay_issued_via_incentive_adp").default(false),
  fnolFiled: boolean("fnol_filed").default(false),
  froiFiled: boolean("froi_filed").default(false),
  wageStatementSent: boolean("wage_statement_sent").default(false),
  earningsStatementSent: boolean("earnings_statement_sent").default(false),
  gaWc1FormSent: boolean("ga_wc1_form_sent").default(false),
  noShowCleared: boolean("no_show_cleared").default(false),
  lateCancellationCleared: boolean("late_cancellation_cleared").default(false),
  shiftsExcused: boolean("shifts_excused").default(false),

  reportNumber: varchar("report_number", { length: 100 }),
  notes: text("notes"),
  litigationNotes: text("litigation_notes"),
  legalRequest: text("legal_request"),
  ratingComplaint: boolean("rating_complaint").default(false),

  intercomLink: text("intercom_link"),
  shiftLink: text("shift_link"),
  irLink: text("ir_link"),
  medicalDocsLink: text("medical_docs_link"),

  createdBy: varchar("created_by", { length: 100 }),
  sourceEmailId: varchar("source_email_id", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by", { length: 100 }),
  deleteReason: text("delete_reason"),
}, (table) => ({
  matterNumberIdx: index("claims_matter_number_idx").on(table.matterNumber),
  deletedStatusIdx: index("claims_deleted_status_idx").on(table.deletedAt, table.claimStatus),
  proIdIdx: index("claims_pro_id_idx").on(table.proId),
  dateOfInjuryIdx: index("claims_doi_idx").on(table.dateOfInjury),
  workerTypeIdx: index("claims_worker_type_idx").on(table.workerType),
  stageIdx: index("claims_stage_idx").on(table.stage),
  tpaClaimIdIdx: index("claims_tpa_claim_id_idx").on(table.tpaClaimId),
  partnerNameIdx: index("claims_partner_name_idx").on(table.partnerName),
}));

export const claimNotes = pgTable("claim_notes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  noteType: noteTypeEnum("note_type").notNull(),
  content: text("content").notNull(),
  author: varchar("author", { length: 100 }).notNull(),
  targetDate: date("target_date"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  claimIdIdx: index("claim_notes_claim_id_idx").on(table.claimId),
}));

export const claimStatusHistory = pgTable("claim_status_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  fromStatus: varchar("from_status", { length: 100 }),
  toStatus: varchar("to_status", { length: 100 }),
  fromStage: varchar("from_stage", { length: 100 }),
  toStage: varchar("to_stage", { length: 100 }),
  changedBy: varchar("changed_by", { length: 100 }),
  changedAt: timestamp("changed_at").defaultNow(),
  reason: text("reason"),
  changes: text("changes"),
}, (table) => ({
  claimIdIdx: index("claim_history_claim_id_idx").on(table.claimId),
}));

export const claimsRelations = relations(claims, ({ many }) => ({
  notes: many(claimNotes),
  statusHistory: many(claimStatusHistory),
}));

export const claimNotesRelations = relations(claimNotes, ({ one }) => ({
  claim: one(claims, { fields: [claimNotes.claimId], references: [claims.id] }),
}));

export const claimStatusHistoryRelations = relations(claimStatusHistory, ({ one }) => ({
  claim: one(claims, { fields: [claimStatusHistory.claimId], references: [claims.id] }),
}));

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  matterNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClaimNoteSchema = createInsertSchema(claimNotes).omit({
  id: true,
  createdAt: true,
});

export const insertClaimStatusHistorySchema = createInsertSchema(claimStatusHistory).omit({
  id: true,
  changedAt: true,
});

export const pros = pgTable("pros", {
  proId: integer("pro_id").primaryKey(),
  name: varchar("name", { length: 300 }),
  givenName: varchar("given_name", { length: 300 }),
  familyName: varchar("family_name", { length: 300 }),
  email: varchar("email", { length: 300 }),
  phone: varchar("phone", { length: 50 }),
  address: varchar("address", { length: 300 }),
  locality: varchar("locality", { length: 200 }),
  state: varchar("state", { length: 200 }),
  stateCode: varchar("state_code", { length: 10 }),
  zipcode: varchar("zipcode", { length: 20 }),
  workerStatus: varchar("worker_status", { length: 100 }),
  workerLevel: varchar("worker_level", { length: 100 }),
  w2Eligible: boolean("w2_eligible"),
  w2Employer: varchar("w2_employer", { length: 300 }),
  w2Status: integer("w2_status"),
  backgroundCheckStatus: integer("background_check_status"),
  noshowCount: integer("noshow_count"),
  dateCreated: timestamp("date_created"),
  lastActive: timestamp("last_active"),
  syncedAt: timestamp("synced_at").defaultNow(),
});

export const proShifts = pgTable("pro_shifts", {
  shiftId: integer("shift_id").primaryKey(),
  proId: integer("pro_id").notNull(),
  businessName: varchar("business_name", { length: 500 }),
  position: varchar("position", { length: 200 }),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  status: varchar("status", { length: 100 }),
  regionName: varchar("region_name", { length: 300 }),
  workerRegionName: varchar("worker_region_name", { length: 300 }),
  subRegionName: varchar("sub_region_name", { length: 300 }),
  zipcode: varchar("zipcode", { length: 20 }),
  geocode: varchar("geocode", { length: 100 }),
  shiftCity: varchar("shift_city", { length: 200 }),
  shiftState: varchar("shift_state", { length: 2 }),
  shiftAddress: varchar("shift_address", { length: 500 }),
  isW2: boolean("is_w2"),
  syncedAt: timestamp("synced_at").defaultNow(),
}, (table) => ({
  proStartsIdx: index("pro_shifts_pro_starts_idx").on(table.proId, table.startsAt),
}));

export const companyTypeEnum = pgEnum("company_type", ["parent", "subsidiary"]);
export const policyStatusEnum = pgEnum("policy_status", ["Active", "Expired"]);

export const companies = pgTable("companies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 500 }).notNull(),
  type: companyTypeEnum("type").notNull().default("subsidiary"),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insurancePolicies = pgTable("insurance_policies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  carrierName: varchar("carrier_name", { length: 500 }).notNull(),
  policyType: varchar("policy_type", { length: 200 }).notNull(),
  policyNumber: varchar("policy_number", { length: 200 }),
  policyYearStart: date("policy_year_start"),
  policyYearEnd: date("policy_year_end"),
  insuredParty: varchar("insured_party", { length: 500 }),
  status: policyStatusEnum("status").notNull().default("Active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertPolicySchema = createInsertSchema(insurancePolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ── Documents ────────────────────────────────────────────────────────────────

export const documentCategoryEnum = pgEnum("document_category", [
  "medical", "legal", "adjuster", "insurance", "internal", "photo", "other",
]);

export const documentSourceEnum = pgEnum("document_source", [
  "upload", "email", "system",
]);

export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  claimId: integer("claim_id").notNull().references(() => claims.id),
  filename: varchar("filename", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  category: documentCategoryEnum("category").notNull(),
  source: documentSourceEnum("source").default("upload").notNull(),
  storagePath: varchar("storage_path", { length: 1000 }).notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  emailMessageId: varchar("email_message_id", { length: 500 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  claimIdIdx: index("documents_claim_id_idx").on(table.claimId),
  categoryIdx: index("documents_category_idx").on(table.category),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  claim: one(claims, { fields: [documents.claimId], references: [claims.id] }),
}));

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});

// ── Type exports ─────────────────────────────────────────────────────────────

export type Claim = typeof claims.$inferSelect;
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type ClaimNote = typeof claimNotes.$inferSelect;
export type InsertClaimNote = z.infer<typeof insertClaimNoteSchema>;
export type ClaimStatusHistory = typeof claimStatusHistory.$inferSelect;
export type InsertClaimStatusHistory = z.infer<typeof insertClaimStatusHistorySchema>;
export type Pro = typeof pros.$inferSelect;
export type InsertPro = typeof pros.$inferInsert;
export type ProShift = typeof proShifts.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsurancePolicy = typeof insurancePolicies.$inferSelect;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
