import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate } from "../scripts/migrate";
import { seed } from "../scripts/seed";
import { pool } from "../src/db";

const app = createApp();

beforeAll(async () => {
  // Boot against the docker Postgres: apply migrations, then reset + seed.
  await migrate();
  await seed();
  await pool.query(
    "INSERT INTO users (id, name, role) VALUES ('5', 'user5', 'member')",
  );
});

afterAll(async () => {
  await pool.end();
});


describe("GET /resources — access control", () => {
  it("returns 401 when no x-user-id header", async () => {
    const res = await request(app).get("/resources");
    expect(res.status).toBe(401);
  });

  it("owner sees only their own resources", async () => {
    const res = await request(app)
      .get("/resources?limit=50")
      .set("x-user-id", "1");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(8);
    expect(res.body.data.every((r: any) => r.owner_id === "1")).toBe(true);
  });

  it("user sees shared resources alongside their own", async () => {
    const res = await request(app)
      .get("/resources?limit=50")
      .set("x-user-id", "2");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(9);
    expect(res.body.data.some((r: any) => r.id === "1")).toBe(true); // Alice's resource shared with Bob
    expect(res.body.data.some((r: any) => r.id === "10")).toBe(true); // Bob's own resource
  });

  it("returns empty array for user with no resources or shares", async () => {
    const res = await request(app)
      .get("/resources?limit=50")
      .set("x-user-id", "5");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });
});
