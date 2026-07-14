import { describe, expect, it, jest } from "@jest/globals";
import { withSessionAdvisoryLock } from "../../server/lib/pg-advisory-lock";

function fakePool() {
  const events: string[] = [];
  const client = {
    query: jest.fn(async (statement: string) => {
      events.push(statement.includes("unlock") ? "unlock" : "lock");
      return { rows: [] } as any;
    }),
    release: jest.fn(() => events.push("release")),
  };
  return {
    events,
    client,
    pool: { connect: jest.fn(async () => client) } as any,
  };
}

describe("PostgreSQL advisory lock wrapper", () => {
  it("holds the same session through the protected work", async () => {
    const fixture = fakePool();
    const result = await withSessionAdvisoryLock(fixture.pool, 7303, 42, async (client) => {
      expect(client).toBe(fixture.client);
      fixture.events.push("work");
      return "done";
    });
    expect(result).toBe("done");
    expect(fixture.events).toEqual(["lock", "work", "unlock", "release"]);
  });

  it("unlocks and releases when protected work throws", async () => {
    const fixture = fakePool();
    await expect(withSessionAdvisoryLock(fixture.pool, 7303, 9, async () => {
      fixture.events.push("work");
      throw new Error("delivery failed");
    })).rejects.toThrow("delivery failed");
    expect(fixture.events).toEqual(["lock", "work", "unlock", "release"]);
  });
});
