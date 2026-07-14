import { describe, expect, it } from "@jest/globals";
import {
  canAttachQuestionBank,
  withoutExamPasswordHash,
} from "../../server/lib/exam-instance-policy";

describe("scheduled exam workspace policy", () => {
  it("permits only the exact creator or institute bank owner", () => {
    expect(canAttachQuestionBank(
      { ownerType: "creator", ownerId: 7 },
      { ownerType: "creator", ownerId: 7 },
      false,
    )).toBe(true);
    expect(canAttachQuestionBank(
      { ownerType: "creator", ownerId: 7 },
      { ownerType: "creator", ownerId: 8 },
      false,
    )).toBe(false);
    expect(canAttachQuestionBank(
      { ownerType: "institute", ownerId: 4 },
      { ownerType: "creator", ownerId: 4 },
      false,
    )).toBe(false);
  });

  it("does not turn public visibility into answer-key permission", () => {
    // Visibility is intentionally absent from the policy input: discovery does
    // not grant execution access to a different workspace's bank.
    expect(canAttachQuestionBank(
      { ownerType: "institute", ownerId: 12 },
      { ownerType: "institute", ownerId: 99 },
      false,
    )).toBe(false);
  });

  it("allows the explicit platform-admin exam exception", () => {
    expect(canAttachQuestionBank(
      { ownerType: "admin", ownerId: 1 },
      { ownerType: "creator", ownerId: 7 },
      true,
    )).toBe(true);
    expect(canAttachQuestionBank(
      { ownerType: "admin", ownerId: 1 },
      { ownerType: "creator", ownerId: 7 },
      false,
    )).toBe(false);
  });

  it("removes password hashes without mutating the source row", () => {
    const source = { id: 10, title: "Private exam", passwordHash: "$2b$12$secret", status: "live" };
    const serialized = withoutExamPasswordHash(source);
    expect(serialized).toEqual({ id: 10, title: "Private exam", status: "live" });
    expect(source.passwordHash).toBe("$2b$12$secret");
    expect("passwordHash" in serialized).toBe(false);
  });
});
