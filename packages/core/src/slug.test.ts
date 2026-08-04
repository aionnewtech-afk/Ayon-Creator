import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Padaria Trigo Dourado")).toBe("padaria-trigo-dourado");
  });

  it("strips accents", () => {
    expect(slugify("Confeitaria São João")).toBe("confeitaria-sao-joao");
  });

  it("strips punctuation not part of a word boundary", () => {
    expect(slugify("Café & Cia. — 100% Natural!")).toBe("cafe-cia-100-natural");
  });

  it("collapses repeated whitespace/hyphens into one hyphen", () => {
    expect(slugify("a   b-c---d")).toBe("a-b-c-d");
  });

  it("strips underscores entirely instead of treating them as separators", () => {
    expect(slugify("a_b__c")).toBe("abc");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  -Trigo Dourado-  ")).toBe("trigo-dourado");
  });

  it("returns an empty string for input with no sluggable characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});
