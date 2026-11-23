import { describe, it, expect, vi } from "vite-plus/test";
import { validateRawLayer } from "../../src/config/config-validation.js";

describe("validateRawLayer — beConcise", () => {
  it("drops a value of the wrong type with a warning and keeps its valid siblings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const cleaned = validateRawLayer({ beConcise: { enabled: "yes", maxChars: 1200 } }, "/g.json");

      expect(cleaned.beConcise).toEqual({ maxChars: 1200 });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("beConcise.enabled");
    } finally {
      warn.mockRestore();
    }
  });

  it("drops a bound that is not a whole positive number", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (const bad of [0, -3, 1.5, "many"]) {
        expect(validateRawLayer({ beConcise: { maxChars: bad } }, "/g.json")).toEqual({});
      }
      expect(warn).toHaveBeenCalledTimes(4);
      expect(warn.mock.calls[0][0]).toContain("whole number of characters");
    } finally {
      warn.mockRestore();
    }
  });

  it("drops a non-object section with a warning instead of crashing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(validateRawLayer({ beConcise: "nope" }, "/g.json")).toEqual({});
      expect(validateRawLayer("text", "/g.json")).toEqual({});
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("validateRawLayer — nulls and the warning shape", () => {
  it("drops a null value, naming the kind it found", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(validateRawLayer({ beConcise: { maxChars: null } }, "/g.json")).toEqual({});
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toContain("null");
    } finally {
      warn.mockRestore();
    }
  });

  it("emits the full warning shape: file, key, got, expected, menu hint, edit-or-delete", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      validateRawLayer({ beConcise: { maxChars: "many" } }, "/g.json");

      expect(warn).toHaveBeenCalledWith(
        `[be-reasonable] Incompatible value in /g.json: "beConcise.maxChars" is string, ` +
          "expected whole number of characters, 1 or more. Set it again in the /be-reasonable menu, " +
          "or edit or delete the file to fix it.",
      );
    } finally {
      warn.mockRestore();
    }
  });
});

describe("validateRawLayer — valid values", () => {
  it("passes valid settings of every kind without warnings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const raw = { beConcise: { enabled: true, maxChars: 1200, message: "Cut it." } };
      expect(validateRawLayer(raw, "/g.json")).toEqual(raw);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("drops a setting this extension does not know, naming it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(validateRawLayer({ beConcise: { trimEverything: true } }, "/g.json")).toEqual({});
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("beConcise.trimEverything");
    } finally {
      warn.mockRestore();
    }
  });

  it("drops a section this extension does not know, naming it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(validateRawLayer({ widget: { showCost: true } }, "/g.json")).toEqual({});
      expect(warn.mock.calls[0][0]).toContain("widget");
    } finally {
      warn.mockRestore();
    }
  });
});
