/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {}
  },
  plugins: [
    require("daisyui"),
    function ({ addUtilities, addVariant }) {
      // ✅ Variants that match html[data-theme="..."] (or any ancestor with data-theme)
      addVariant("lncsignlight", '[data-theme="lncsignlight"] &');
      addVariant("lncsigndark", '[data-theme="lncsigndark"] &');

      addUtilities({
        // Prevent iOS long-press popup
        ".touch-callout-none": {
          "-webkit-touch-callout": "none"
        },
        // VS Code-style disabled button for all themes
        ".op-btn-vscode-disabled": {
          "background-color": "#3C3C3C !important",
          color: "#CCCCCC !important",
          "border-color": "#565656 !important",
          cursor: "not-allowed !important",
          opacity: "1 !important",
          "&:hover": {
            "background-color": "#3C3C3C !important",
            color: "#CCCCCC !important",
            "border-color": "#565656 !important",
            transform: "none !important"
          }
        },
        // Dark mode icon improvements using DaisyUI theme detection
        '[data-theme="lncsigndark"] .icon-improved': {
          color: "#CCCCCC !important"
        },
        '[data-theme="lncsigndark"] .icon-muted': {
          color: "#999999 !important"
        },
        '[data-theme="lncsigndark"] .icon-disabled': {
          color: "#858585 !important"
        },
        // Gray text improvements for dark mode
        '[data-theme="lncsigndark"] .text-gray-500': {
          color: "#CCCCCC !important"
        },
        '[data-theme="lncsigndark"] .text-gray-400': {
          color: "#999999 !important"
        },
        '[data-theme="lncsigndark"] .text-gray-600': {
          color: "#CCCCCC !important"
        },
        // CSS variable utilities that work with arbitrary values
        ".icon-themed": {
          color: "var(--icon-color)"
        },
        ".icon-themed-muted": {
          color: "var(--icon-color-muted)"
        },
        ".icon-themed-disabled": {
          color: "var(--icon-color-disabled)"
        },
        ".btn-themed-disabled": {
          "background-color": "var(--btn-disabled-bg)",
          color: "var(--btn-disabled-color)",
          "border-color": "var(--btn-disabled-border)",
          cursor: "not-allowed",
          "&:hover": {
            "background-color": "var(--btn-disabled-bg)",
            color: "var(--btn-disabled-color)",
            "border-color": "var(--btn-disabled-border)",
            transform: "none"
          }
        }
      });
    }
  ],
  daisyui: {
    // themes: true,
    themes: [
      {
        // Light NC Sign dark theme (Pulpit tokens from LNC-IS)
        lncsigndark: {
          primary: "#FAD719",
          "primary-content": "#3F3F40",
          secondary: "#1D1D1C",
          "secondary-content": "#E8E8E6",
          accent: "#FFE042",
          "accent-content": "#3F3F40",
          neutral: "#2A2A2B",
          "neutral-content": "#E8E8E6",
          "base-100": "#0A0A09",
          "base-200": "#161615",
          "base-300": "#1D1D1C",
          "base-content": "#E8E8E6",
          info: "#2563EB",
          success: "#22C55E",
          warning: "#FBBF24",
          error: "#EF4444",
          "--rounded-btn": "1.9rem",
          "--tab-border": "2px",
          "--tab-radius": "0.7rem",
          "--icon-color": "#CCCCCC",
          "--icon-color-muted": "#999999",
          "--icon-color-disabled": "#858585",
          "--btn-disabled-bg": "#3C3C3C",
          "--btn-disabled-color": "#CCCCCC",
          "--btn-disabled-border": "#565656",
          "--navbar-padding": "0.8rem",
          "--border-color": "#2A2A2B",
          "--tooltip-color": "#1D1D1C"
        }
      },
      {
        // Light NC Sign light theme (Pulpit tokens from LNC-IS)
        lncsignlight: {
          primary: "#FAD719",
          "primary-content": "#3F3F40",
          secondary: "#3F3F40",
          "secondary-content": "#F4F3EE",
          accent: "#968600",
          "accent-content": "#ffffff",
          neutral: "#E4E7EC",
          "neutral-content": "#3F3F40",
          "base-100": "#ffffff",
          "base-200": "#F4F3EE",
          "base-300": "#E4E7EC",
          "base-content": "#3F3F40",
          info: "#00b6ff",
          "info-content": "#f5f5f4",
          success: "#00a96e",
          "success-content": "#f5f5f4",
          warning: "#ffbe00",
          "warning-content": "#3F3F40",
          error: "#ffa1a7",
          "error-content": "#16090a",
          "--rounded-btn": "1.9rem",
          "--tab-border": "2px",
          "--tab-radius": "0.7rem"
        }
      }
    ],
    prefix: "op-"
  }
};
