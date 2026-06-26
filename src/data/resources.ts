import { pool } from "../db";

export interface FindResourcesOpts {
  ownerId?: number;
  limit?: number;
  orderBy?: string;
  offset?: number;
  type?: string;
  status?: string;
  viewerId?: number;
}

export interface ResourceRow {
  id: string;
  owner_id: string;
  type: string;
  status: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

// SHARED PATH — used by multiple endpoints. Changing this affects all callers.
//
// There is NO access control here: every caller sees every resource it asks
// for, regardless of who is making the request. The auth stub populates
// req.userId but it never reaches this function.
export async function findResources(
  opts: FindResourcesOpts = {},
): Promise<ResourceRow[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  let sql = `
    SELECT id, owner_id, type, status, title, created_at, updated_at
    FROM resources
  `;

  if (opts.ownerId !== undefined) {
    params.push(opts.ownerId);
    conditions.push(`owner_id = $${params.length}`);
  }

  if (opts.viewerId !== undefined) {
    params.push(opts.viewerId);
    conditions.push(
      `(owner_id = $${params.length} OR id IN (SELECT resource_id FROM resource_shares WHERE user_id = $${params.length}))`,
    );
  }

  if (opts.type !== undefined) {
    params.push(opts.type);
    conditions.push(`type = $${params.length}`);
  }

  if (opts.status !== undefined) {
    params.push(opts.status);
    conditions.push(`status = $${params.length}`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  // orderBy is only ever passed internally (never from request input).
  if (opts.orderBy) {
    sql += ` ORDER BY ${opts.orderBy}`;
  }

  if (opts.limit !== undefined) {
    params.push(opts.limit);
    sql += ` LIMIT $${params.length}`;
  }

  if (opts.offset !== undefined) {
    params.push(opts.offset);
    sql += ` OFFSET $${params.length}`;
  }

  const result = await pool.query<ResourceRow>(sql, params);
  return result.rows;
}
