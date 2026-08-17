import { describe, it } from "node:test";
import assert from "node:assert";
import {
  BRAND,
  brandGradient,
  brandPrimary,
  brandSecondary,
  trafficLightCss,
  badgeDotCss,
  brandShadowCss,
  lighten,
} from "../src/brand.js";

describe("BRAND tokens", () => {
  it("loads the real token file (primary teal #00d4aa)", () => {
    assert.equal(BRAND.colors.brand.primary, "#00d4aa");
    assert.equal(BRAND.colors.brand.secondary, "#0099ff");
  });

  it("has a semantic success/error/warning mapping", () => {
    assert.ok(BRAND.colors.semantic.success.startsWith("#"));
    assert.ok(BRAND.colors.semantic.error.startsWith("#"));
    assert.ok(BRAND.colors.semantic.warning.startsWith("#"));
  });

  it("exposes typography and shadows", () => {
    assert.ok(BRAND.typography.fontStack.mono.length > 0);
    assert.ok(BRAND.shadows.soft.includes("rgba"));
    assert.equal(brandShadowCss("none"), "none");
  });

  it("unknown shadow level falls back to soft", () => {
    assert.equal(brandShadowCss("nonexistent-level"), BRAND.shadows.soft);
  });
});

describe("brand helpers", () => {
  it("brandPrimary() returns the primary token", () => {
    assert.equal(brandPrimary(), "#00d4aa");
  });

  it("brandSecondary() returns the secondary token", () => {
    assert.equal(brandSecondary(), "#0099ff");
  });

  it("brandGradient() returns a CSS gradient", () => {
    const g = brandGradient();
    assert.ok(g.startsWith("linear-gradient("));
    assert.ok(g.includes("#00d4aa"));
    assert.ok(g.includes("#0099ff"));
  });

  it("trafficLightCss() emits three dot rules", () => {
    const css = trafficLightCss();
    assert.ok(css.includes(".dot.red"));
    assert.ok(css.includes(".dot.yellow"));
    assert.ok(css.includes(".dot.green"));
  });

  it("badgeDotCss() references the brand gradient", () => {
    assert.ok(badgeDotCss().includes("background:"));
    assert.ok(badgeDotCss().includes("linear-gradient"));
  });
});

describe("lighten", () => {
  it("lightens a hex color by a percentage", () => {
    assert.equal(lighten("#000000", 1), "#ffffff");
    assert.equal(lighten("#101010", 0.5), "#909090");
  });

  it("never exceeds 255 per channel", () => {
    assert.equal(lighten("#ffffff", 1), "#ffffff");
    assert.equal(lighten("#00d4aa", 0.9), "#e6ffff");
  });

  it("handles missing hash prefix", () => {
    assert.equal(lighten("000000", 1), "#ffffff");
  });
});