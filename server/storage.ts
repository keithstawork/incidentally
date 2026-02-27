import {
  claims,
  claimNotes,
  claimStatusHistory,
  type Claim,
  type InsertClaim,
  type ClaimNote,
  type InsertClaimNote,
  type ClaimStatusHistory,
  type InsertClaimStatusHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, ilike, or, and, gte, lte, count } from "drizzle-orm";

export interface IStorage {
  getClaims(filters?: ClaimFilters): Promise<Claim[]>;
  getClaim(id: number): Promise<Claim | undefined>;
  createClaim(claim: InsertClaim): Promise<Claim>;
  updateClaim(id: number, claim: Partial<InsertClaim>): Promise<Claim | undefined>;
  deleteClaim(id: number): Promise<void>;
  getClaimNotes(claimId: number): Promise<ClaimNote[]>;
  createClaimNote(note: InsertClaimNote): Promise<ClaimNote>;
  updateClaimNote(id: number, updates: Partial<InsertClaimNote>): Promise<ClaimNote | undefined>;
  getClaimStatusHistory(claimId: number): Promise<ClaimStatusHistory[]>;
  createClaimStatusHistory(entry: InsertClaimStatusHistory): Promise<ClaimStatusHistory>;
  getDashboardStats(): Promise<DashboardStats>;
  searchClaims(query: string): Promise<Claim[]>;
}

export interface ClaimFilters {
  stage?: string;
  claimStatus?: string;
  workerType?: string;
  stateOfInjury?: string;
  partnerName?: string;
  carrier?: string;
  litigated?: boolean;
  tnsSpecialist?: string;
  search?: string;
}

export interface DashboardStats {
  totalOpen: number;
  newThisWeek: number;
  totalIncurred: number;
  inLitigation: number;
  pendingAction: number;
  statusBreakdown: { status: string; count: number }[];
  monthlyBreakdown: { month: string; count: number }[];
}

export class DatabaseStorage implements IStorage {
  async getClaims(filters?: ClaimFilters): Promise<Claim[]> {
    let conditions: any[] = [];
    if (filters) {
      if (filters.stage) conditions.push(eq(claims.stage, filters.stage as any));
      if (filters.claimStatus) conditions.push(eq(claims.claimStatus, filters.claimStatus as any));
      if (filters.workerType) conditions.push(eq(claims.workerType, filters.workerType as any));
      if (filters.stateOfInjury) conditions.push(eq(claims.stateOfInjury, filters.stateOfInjury));
      if (filters.partnerName) conditions.push(ilike(claims.partnerName, `%${filters.partnerName}%`));
      if (filters.carrier) conditions.push(ilike(claims.carrier!, `%${filters.carrier}%`));
      if (filters.litigated !== undefined) conditions.push(eq(claims.litigated, filters.litigated));
      if (filters.tnsSpecialist) conditions.push(eq(claims.tnsSpecialist, filters.tnsSpecialist));
      if (filters.search) {
        conditions.push(
          or(
            ilike(claims.firstName, `%${filters.search}%`),
            ilike(claims.lastName, `%${filters.search}%`),
            ilike(claims.partnerName, `%${filters.search}%`),
            ilike(claims.tpaClaimId!, `%${filters.search}%`)
          )
        );
      }
    }

    if (conditions.length > 0) {
      return await db.select().from(claims).where(and(...conditions)).orderBy(desc(claims.createdAt));
    }
    return await db.select().from(claims).orderBy(desc(claims.createdAt));
  }

  async getClaim(id: number): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(eq(claims.id, id));
    return claim || undefined;
  }

  async createClaim(claim: InsertClaim): Promise<Claim> {
    const [newClaim] = await db.insert(claims).values(claim).returning();
    return newClaim;
  }

  async updateClaim(id: number, updates: Partial<InsertClaim>): Promise<Claim | undefined> {
    const [updated] = await db
      .update(claims)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteClaim(id: number): Promise<void> {
    await db.delete(claims).where(eq(claims.id, id));
  }

  async getClaimNotes(claimId: number): Promise<ClaimNote[]> {
    return await db
      .select()
      .from(claimNotes)
      .where(eq(claimNotes.claimId, claimId))
      .orderBy(desc(claimNotes.createdAt));
  }

  async createClaimNote(note: InsertClaimNote): Promise<ClaimNote> {
    const [newNote] = await db.insert(claimNotes).values(note).returning();
    return newNote;
  }

  async updateClaimNote(id: number, updates: Partial<InsertClaimNote>): Promise<ClaimNote | undefined> {
    const [updated] = await db
      .update(claimNotes)
      .set(updates)
      .where(eq(claimNotes.id, id))
      .returning();
    return updated || undefined;
  }

  async getClaimStatusHistory(claimId: number): Promise<ClaimStatusHistory[]> {
    return await db
      .select()
      .from(claimStatusHistory)
      .where(eq(claimStatusHistory.claimId, claimId))
      .orderBy(desc(claimStatusHistory.changedAt));
  }

  async createClaimStatusHistory(entry: InsertClaimStatusHistory): Promise<ClaimStatusHistory> {
    const [newEntry] = await db.insert(claimStatusHistory).values(entry).returning();
    return newEntry;
  }

  async searchClaims(query: string): Promise<Claim[]> {
    return await db
      .select()
      .from(claims)
      .where(
        or(
          ilike(claims.firstName, `%${query}%`),
          ilike(claims.lastName, `%${query}%`),
          ilike(claims.partnerName, `%${query}%`),
          ilike(claims.tpaClaimId!, `%${query}%`)
        )
      )
      .orderBy(desc(claims.createdAt))
      .limit(50);
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const allClaims = await db.select().from(claims);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const totalOpen = allClaims.filter(c => c.claimStatus === "Open").length;
    const newThisWeek = allClaims.filter(c => c.createdAt && c.createdAt >= oneWeekAgo).length;
    const openClaims = allClaims.filter(c => c.claimStatus === "Open");
    const totalIncurred = openClaims.reduce((sum, c) => {
      return sum + parseFloat(c.totalPayments || "0") + parseFloat(c.totalOutstanding || "0");
    }, 0);
    const inLitigation = allClaims.filter(c => c.litigated || c.stage === "litigation").length;

    const notes = await db.select().from(claimNotes);
    const pendingAction = notes.filter(
      n => !n.completed && n.targetDate && new Date(n.targetDate) < new Date()
    ).length;

    const statusMap = new Map<string, number>();
    allClaims.forEach(c => {
      const status = c.claimStatus || "Unknown";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    const statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    const monthMap = new Map<string, number>();
    allClaims.forEach(c => {
      if (c.dateOfInjury) {
        const d = new Date(c.dateOfInjury);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(month, (monthMap.get(month) || 0) + 1);
      }
    });
    const monthlyBreakdown = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    return {
      totalOpen,
      newThisWeek,
      totalIncurred,
      inLitigation,
      pendingAction,
      statusBreakdown,
      monthlyBreakdown,
    };
  }
}

export const storage = new DatabaseStorage();
