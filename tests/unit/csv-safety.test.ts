import { describe, expect, it } from "@jest/globals";
import {
  neutralizeSpreadsheetCell,
  safeCsvCell,
} from "../../server/lib/csv-safety";

describe("CSV spreadsheet safety", () => {
  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "  =HYPERLINK(\"https://bad\")"])(
    "neutralizes formula-like string %s",
    (value) => {
      expect(neutralizeSpreadsheetCell(value)).toBe(`'${value}`);
    },
  );

  it("preserves ordinary text and numeric values", () => {
    expect(neutralizeSpreadsheetCell("Assessment title")).toBe("Assessment title");
    expect(neutralizeSpreadsheetCell(42)).toBe(42);
  });

  it("quotes fields and doubles embedded quotes after neutralizing", () => {
    expect(safeCsvCell('=HYPERLINK("https://bad")')).toBe(
      `"'=HYPERLINK(""https://bad"")"`,
    );
    expect(safeCsvCell('Learner "A"')).toBe(`"Learner ""A"""`);
  });
});
