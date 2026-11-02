import { describe, it, expect } from "vitest";
import { validate, statusAfterExtraction, changedFields, computeAccuracy, ACCURACY_FIELDS } from "@/lib/doc-schema";
import { SAMPLES } from "@/lib/samples";

const today = new Date("2026-11-02T00:00:00Z");
const conf = (v: number) => Object.fromEntries(ACCURACY_FIELDS.map((f) => [f, v]));
const [s1, s2, s3] = SAMPLES as [typeof SAMPLES[0] & {}, typeof SAMPLES[0] & {}, typeof SAMPLES[0] & {}];

describe("validation rules", () => {
  it("sample 1 passes every rule", () => expect(validate(s1.data, today).every((r) => r.pass)).toBe(true));
  it("sample 2 (VAT-exempt) passes every rule", () => expect(validate(s2.data, today).every((r) => r.pass)).toBe(true));
  it("sample 3 fails only the totals rule (PHP 100 too high)", () => {
    const failed = validate(s3.data, today).filter((r) => !r.pass);
    expect(failed.map((r) => r.id)).toEqual(["totals"]);
    expect(failed[0]!.detail).toContain("100.00 higher");
  });
  it("tolerates ±1.00", () => {
    expect(validate({ ...s1.data, total_amount: 5063.4 }, today).find((r) => r.id === "totals")!.pass).toBe(true);
    expect(validate({ ...s1.data, total_amount: 5063.5 }, today).find((r) => r.id === "totals")!.pass).toBe(false);
  });
  it("TIN last group may be 3–5 digits", () => {
    const tin = (t: string) => validate({ ...s1.data, vendor_tin: t }, today).find((r) => r.id === "tin")!.pass;
    expect(tin("123-456-789-000")).toBe(true);
    expect(tin("123-456-789-00000")).toBe(true);
    expect(tin("123-456-789-00")).toBe(false);
    expect(tin("123-456-789-000000")).toBe(false);
  });
  it("rejects future dates", () => {
    expect(validate({ ...s1.data, invoice_date: "2026-12-01" }, today).find((r) => r.id === "date")!.pass).toBe(false);
  });
});

describe("status routing", () => {
  const ok = validate(s1.data, today);
  it("needs review when any field < 0.75", () => expect(statusAfterExtraction({ ...conf(0.95), vendor_tin: 0.7 }, ok, true)).toBe("needs_review"));
  it("needs review when a rule fails", () => expect(statusAfterExtraction(conf(0.95), validate(s3.data, today), true)).toBe("needs_review"));
  it("needs review for clean docs when auto-approve is off", () => expect(statusAfterExtraction(conf(0.95), ok, false)).toBe("needs_review"));
  it("auto-approves clean docs when enabled", () => expect(statusAfterExtraction(conf(0.95), ok, true)).toBe("approved"));
});

describe("accuracy", () => {
  it("an edited field drops below 100%", () => {
    const changed = changedFields(s1.data, { ...s1.data, vendor_name: "Other" });
    expect(changed).toEqual(["vendor_name"]);
    const a = computeAccuracy([{ changed_fields: changed, confidence: conf(0.95), validation_extracted: [], processing_ms: 1000 }, { changed_fields: [], confidence: conf(0.95), validation_extracted: [], processing_ms: 3000 }]);
    expect(a.perField.find((p) => p.field === "vendor_name")!.accuracy).toBe(0.5);
    expect(a.perField.find((p) => p.field === "total_amount")!.accuracy).toBe(1);
    expect(a.avgMs).toBe(2000);
  });
});
