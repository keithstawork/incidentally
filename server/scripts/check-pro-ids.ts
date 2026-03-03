import { db, pool } from "../db";
import { claims } from "@shared/schema";
import { isNull, sql } from "drizzle-orm";

async function run() {
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(claims).where(isNull(claims.deletedAt));
  const [withPro] = await db.select({ count: sql<number>`count(*)` }).from(claims).where(sql`pro_id IS NOT NULL AND pro_id != '' AND deleted_at IS NULL`);
  const [withoutPro] = await db.select({ count: sql<number>`count(*)` }).from(claims).where(sql`(pro_id IS NULL OR pro_id = '') AND deleted_at IS NULL`);

  console.log(`Total active claims: ${total.count}`);
  console.log(`With Pro ID:         ${withPro.count}`);
  console.log(`Missing Pro ID:      ${withoutPro.count}`);

  const missing = await db.select({
    id: claims.id,
    matterNumber: claims.matterNumber,
    firstName: claims.firstName,
    lastName: claims.lastName,
    proId: claims.proId,
    dateOfInjury: claims.dateOfInjury,
  }).from(claims)
    .where(sql`(pro_id IS NULL OR pro_id = '') AND deleted_at IS NULL`)
    .orderBy(claims.lastName, claims.firstName);

  if (missing.length > 0) {
    console.log(`\n--- All ${missing.length} claims missing Pro ID ---`);
    missing.forEach((c) => {
      console.log(`  ${c.matterNumber || "#" + c.id}  ${c.lastName}, ${c.firstName}  DOI: ${c.dateOfInjury}  proId: ${c.proId || "(empty)"}`);
    });
  }

  pool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  pool.end();
  process.exit(1);
});
