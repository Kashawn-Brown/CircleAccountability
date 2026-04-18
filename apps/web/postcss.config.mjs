// PostCSS config for the Next.js web app.
// Registers Tailwind CSS v4 as a PostCSS plugin so utility classes
// referenced in JSX (e.g. bg-slate-950) get generated at build time.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
