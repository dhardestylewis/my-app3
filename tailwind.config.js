/** @type {import('tailwindcss').Config} */
module.exports = {
  // ADDED: Enable class-based dark mode, standard for CSS variable themes
  darkMode: ["class"],
  // MAINTAINED: Your original content path configuration
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    // Consider adding './app/**/*.{js,jsx,ts,tsx}' if you use Next.js App Router
  ],
  // ADDED: Explicitly state that no prefix is used (standard practice)
  prefix: "",
  theme: {
    // ADDED: Standard container settings (optional, adjust if needed or remove if unused)
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    // UPDATED: Added color and borderRadius extensions
    extend: {
      // UPDATED: Color definitions mapping to CSS variables from globals.css
      // Wrapped var() in oklch() for explicit parsing
      colors: {
        // Use oklch() function explicitly
        border: 'oklch(var(--border))',
        input: 'oklch(var(--input))',
        // Note: Ring might have opacity defined in the variable itself or applied via utility
        // If applied via utility (e.g., ring-primary/50), this basic definition might
        // need adjustment later, but let's fix the base case first.
        ring: 'oklch(var(--ring))',

        background: 'oklch(var(--background))',
        foreground: 'oklch(var(--foreground))',

        primary: {
          DEFAULT: 'oklch(var(--primary))',
          foreground: 'oklch(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary))',
          foreground: 'oklch(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive))',
          foreground: 'oklch(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'oklch(var(--muted))',
          foreground: 'oklch(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'oklch(var(--accent))',
          foreground: 'oklch(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'oklch(var(--popover))',
          foreground: 'oklch(var(--popover-foreground))',
        },
        card: {
          // Apply the oklch() wrapper here too
          DEFAULT: 'oklch(var(--card))',
          foreground: 'oklch(var(--card-foreground))',
        },
        // You can add sidebar variables here too if needed later
      },
      // MAINTAINED: Border radius mapping to CSS variable from globals.css
      // This usually works fine with calc() and var()
      borderRadius: {
        lg: 'var(--radius)', // Maps rounded-lg to your CSS variable
        md: 'calc(var(--radius) - 2px)', // Example: Creates rounded-md relative to --radius
        sm: 'calc(var(--radius) - 4px)', // Example: Creates rounded-sm relative to --radius
      },
      // MAINTAINED: Placeholder for any future keyframes/animations you add
      keyframes: {
         // Add custom keyframes here
      },
      animation: {
         // Add custom animations here
      },
    },
  },
  // MAINTAINED: Added tailwindcss-animate plugin
  plugins: [
    require("tailwindcss-animate"),
    // Add other plugins here if you use them
  ],
}