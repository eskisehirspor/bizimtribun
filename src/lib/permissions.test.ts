import assert from "node:assert/strict";
import { test } from "node:test";
import { can, canBanRole, isStaffRole, permissionsFor, roleRank } from "./permissions";

test("plain users have no staff permissions", () => {
  assert.deepEqual(permissionsFor("user"), []);
  assert.equal(can("user", "admin.access"), false);
  assert.equal(can(undefined, "admin.access"), false);
  assert.equal(isStaffRole("user"), false);
});

test("each role is a superset of the one below", () => {
  const order = ["moderator", "admin", "super_admin"];
  for (let i = 1; i < order.length; i += 1) {
    const lower = permissionsFor(order[i - 1]);
    const upper = new Set(permissionsFor(order[i]));
    for (const p of lower) assert.ok(upper.has(p), `${order[i]} lacks ${p}`);
  }
  assert.ok(roleRank("super_admin") > roleRank("admin"));
});

test("role management and settings are super-admin only", () => {
  assert.equal(can("admin", "roles.manage"), false);
  assert.equal(can("super_admin", "roles.manage"), true);
  assert.equal(can("admin", "settings.manage"), false);
  assert.equal(can("moderator", "votes.void"), false);
  assert.equal(can("admin", "votes.void"), true);
});

test("ban matrix", () => {
  assert.equal(canBanRole("moderator", "user"), true);
  assert.equal(canBanRole("moderator", "moderator"), false);
  assert.equal(canBanRole("admin", "moderator"), true);
  assert.equal(canBanRole("super_admin", "admin"), false);
  assert.equal(canBanRole("user", "user"), false);
});
