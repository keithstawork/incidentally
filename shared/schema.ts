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
  tpaClaimId: varchar("tpa_claim_id", { length: 100 }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
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
});

export const claimNotes = pgTable("claim_notes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  noteType: noteTypeEnum("note_type").notNull(),
  content: text("content").notNull(),
  author: varchar("author", { length: 100 }).notNull(),
  targetDate: date("target_date"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

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
});

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

export type Claim = typeof claims.$inferSelect;
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type ClaimNote = typeof claimNotes.$inferSelect;
export type InsertClaimNote = z.infer<typeof insertClaimNoteSchema>;
export type ClaimStatusHistory = typeof claimStatusHistory.$inferSelect;
export type InsertClaimStatusHistory = z.infer<typeof insertClaimStatusHistorySchema>;
