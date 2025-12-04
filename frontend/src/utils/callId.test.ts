import { describe, it, expect } from "vitest";
import { extractCallId, isValidCallId } from "./callId";

describe("extractCallId", () => {
  it("should extract call ID from URL with startapp parameter", () => {
    const url = "https://t.me/bot?startapp=abc123xyz";
    expect(extractCallId(url)).toBe("abc123xyz");
  });

  it("should extract call ID from URL with callId parameter", () => {
    const url = "https://example.com?callId=test_call_123";
    expect(extractCallId(url)).toBe("test_call_123");
  });

  it("should extract call ID from URL with call_id parameter", () => {
    const url = "https://example.com?call_id=my-call-id";
    expect(extractCallId(url)).toBe("my-call-id");
  });

  it("should extract call ID from URL with id parameter", () => {
    const url = "https://example.com?id=simple123";
    expect(extractCallId(url)).toBe("simple123");
  });

  it("should extract call ID from URL hash", () => {
    const url = "https://example.com#call123";
    expect(extractCallId(url)).toBe("call123");
  });

  it("should return raw call ID if not a URL", () => {
    const callId = "direct_call_id_123";
    expect(extractCallId(callId)).toBe(callId);
  });

  it("should return null for empty string", () => {
    expect(extractCallId("")).toBeNull();
    expect(extractCallId("   ")).toBeNull();
  });

  it("should trim whitespace from input", () => {
    const callId = "  call123  ";
    expect(extractCallId(callId)).toBe("call123");
  });

  it("should return null for URL without recognized parameters", () => {
    const url = "https://example.com";
    expect(extractCallId(url)).toBeNull();
  });
});

describe("isValidCallId", () => {
  it("should validate correct call IDs", () => {
    expect(isValidCallId("abc123")).toBe(true);
    expect(isValidCallId("call_123")).toBe(true);
    expect(isValidCallId("call-456")).toBe(true);
    expect(isValidCallId("ABC_xyz-123")).toBe(true);
  });

  it("should reject call IDs that are too short", () => {
    expect(isValidCallId("abc12")).toBe(false);
    expect(isValidCallId("a")).toBe(false);
  });

  it("should reject call IDs that are too long", () => {
    const longId = "a".repeat(65);
    expect(isValidCallId(longId)).toBe(false);
  });

  it("should reject call IDs with invalid characters", () => {
    expect(isValidCallId("call@123")).toBe(false);
    expect(isValidCallId("call#123")).toBe(false);
    expect(isValidCallId("call 123")).toBe(false);
    expect(isValidCallId("call.123")).toBe(false);
  });

  it("should reject empty strings", () => {
    expect(isValidCallId("")).toBe(false);
  });
});
