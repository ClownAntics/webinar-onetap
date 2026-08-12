// Per-organization branding for the public landing pages.
// Three brands doesn't justify DB-driven theming — a typed constant is the
// source of truth. Colors override the --fp-* tokens in globals.css.

export const BRANDS = ["facepaint", "clownantics", "careerlearning"] as const;
export type Brand = (typeof BRANDS)[number];

export interface BrandTheme {
  key: Brand;
  /** Customer-facing name, used in the fallback title + mailing-list line. */
  name: string;
  /** Path under /public, or null to render a text monogram instead. */
  logoSrc: string | null;
  disclosure: string;
  /** FacePaint's page is playful; careerlearning's audience is professional. */
  confetti: boolean;
  /** CSS custom-property overrides applied at the page root. */
  vars: Record<string, string>;
}

export const BRAND_THEMES: Record<Brand, BrandTheme> = {
  facepaint: {
    key: "facepaint",
    name: "FacePaint.com",
    logoSrc: "/fp-logo.jpg",
    disclosure: "By registering, you join the FacePaint.com mailing list. Unsubscribe anytime.",
    confetti: true,
    vars: {}, // globals.css defaults ARE the FacePaint theme
  },
  clownantics: {
    key: "clownantics",
    name: "Clownantics.com",
    logoSrc: null, // drop /cl-logo.png into /public and set this
    disclosure: "By registering, you join the Clownantics.com mailing list. Unsubscribe anytime.",
    confetti: true,
    vars: {
      "--fp-yellow": "#e4262c",
      "--fp-yellow-hover": "#f0454a",
      "--fp-yellow-shadow": "#9e1418",
      "--fp-cta-text": "#ffffff",
    },
  },
  careerlearning: {
    key: "careerlearning",
    name: "CareerLearning.com",
    logoSrc: null, // drop /career-logo.png into /public and set this
    disclosure: "By registering, you join the CareerLearning.com mailing list. Unsubscribe anytime.",
    confetti: false,
    vars: {
      "--fp-bg": "#1b2a4a",
      "--fp-yellow": "#f5a623",
      "--fp-yellow-hover": "#ffb946",
      "--fp-yellow-shadow": "#b87a10",
      "--fp-blue": "#5c9ddb",
    },
  },
};

export function getBrand(key: string | null | undefined): BrandTheme {
  return BRAND_THEMES[(key as Brand) ?? "facepaint"] ?? BRAND_THEMES.facepaint;
}

export const BRAND_LABELS: Record<Brand, string> = {
  facepaint: "FacePaint",
  clownantics: "Clownantics",
  careerlearning: "CareerLearning",
};
