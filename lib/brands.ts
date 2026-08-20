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
  /** Intrinsic pixel size of the logo file (next/image needs it). */
  logoSize?: { width: number; height: number };
  /** "round" = 76px circle crop (FacePaint); "wide" = uncropped wordmark. */
  logoShape?: "round" | "wide";
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
    logoSize: { width: 76, height: 76 },
    logoShape: "round",
    disclosure: "By registering, you join the FacePaint.com mailing list. Unsubscribe anytime.",
    confetti: true,
    vars: {}, // globals.css defaults ARE the FacePaint theme
  },
  // Palette from the Clownantics style guide (logo colors #F10505 red /
  // #FFFF01 yellow / #0186FF blue; main colors add #45b308 / #14BCFC).
  // Bright white page like clownantics.com, red CTA, logo-color confetti.
  clownantics: {
    key: "clownantics",
    name: "Clownantics.com",
    logoSrc: "/clownantics-logo.jpg",
    logoSize: { width: 378, height: 198 },
    logoShape: "wide",
    disclosure: "By registering, you join the Clownantics.com mailing list. Unsubscribe anytime.",
    confetti: true,
    vars: {
      "--fp-bg": "#ffffff",
      "--fp-white": "#000000",
      "--fp-text-85": "rgba(0, 0, 0, 0.85)",
      "--fp-text-65": "rgba(0, 0, 0, 0.65)",
      "--fp-text-60": "rgba(0, 0, 0, 0.6)",
      "--fp-text-40": "rgba(0, 0, 0, 0.45)",
      "--fp-yellow": "#f10505",
      "--fp-yellow-hover": "#ff2b2b",
      "--fp-yellow-shadow": "#a80303",
      "--fp-cta-text": "#ffffff",
      "--fp-blue": "#0186ff",
      "--fp-input-bg": "rgba(0, 0, 0, 0.04)",
      "--fp-input-border": "rgba(0, 0, 0, 0.35)",
      "--fp-placeholder": "rgba(0, 0, 0, 0.5)",
      "--fp-outline": "rgba(0, 0, 0, 0.35)",
      "--fp-spinner-track": "rgba(0, 0, 0, 0.15)",
      "--fp-surface": "rgba(0, 0, 0, 0.06)",
      "--fp-confetti-pink": "#f10505",
      "--fp-confetti-green": "#45b308",
      "--fp-confetti-yellow": "#f0d000", // guide's #FFFF01 is invisible on white
      "--fp-confetti-blue": "#0186ff",
      "--fp-confetti-orange": "#14bcfc",
    },
  },
  // Palette from the CareerLearning brand guide: primary #2e3192 indigo +
  // #00a3c9 cyan, secondary blues; bright/bold but elegant, lots of white space.
  careerlearning: {
    key: "careerlearning",
    name: "CareerLearning.com",
    logoSrc: "/careerlearning-logo.png",
    logoSize: { width: 1200, height: 384 },
    logoShape: "wide",
    disclosure: "By registering, you join the CareerLearning.com mailing list. Unsubscribe anytime.",
    confetti: false,
    vars: {
      "--brand-font": "var(--font-poppins)", // brand guide specifies Poppins
      "--fp-bg": "#ffffff",
      "--fp-white": "#2e3192",
      "--fp-text-85": "rgba(46, 49, 146, 0.9)",
      "--fp-text-65": "rgba(46, 49, 146, 0.75)",
      "--fp-text-60": "rgba(46, 49, 146, 0.7)",
      "--fp-text-40": "rgba(46, 49, 146, 0.55)",
      "--fp-yellow": "#00a3c9",
      "--fp-yellow-hover": "#14b7dd",
      "--fp-yellow-shadow": "#007b98",
      "--fp-cta-text": "#ffffff",
      "--fp-blue": "#146bb5",
      "--fp-input-bg": "rgba(46, 49, 146, 0.05)",
      "--fp-input-border": "rgba(46, 49, 146, 0.35)",
      "--fp-placeholder": "rgba(46, 49, 146, 0.55)",
      "--fp-outline": "rgba(46, 49, 146, 0.35)",
      "--fp-spinner-track": "rgba(46, 49, 146, 0.2)",
      "--fp-surface": "rgba(46, 49, 146, 0.08)",
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
