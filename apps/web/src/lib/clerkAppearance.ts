import { dark } from '@clerk/themes';
import type { Appearance } from '@clerk/types';

// Shared appearance for Clerk's prebuilt <SignIn /> and <SignUp />.
// Starts from Clerk's `dark` base theme (correct defaults for OTP inputs,
// captcha widgets, internal icons) then overrides each structural element
// with explicit Tailwind classes so the card matches our slate + emerald
// palette. Variables alone aren't enough — Clerk's dark theme sets its own
// element styles that win on conflicts, so element-level class overrides
// are what actually take effect. Palette mirrors apps/mobile/src/lib/theme.ts.
export const clerkAppearance: Appearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#059669',
    colorDanger: '#ef4444',
    borderRadius: '0.625rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  elements: {
    // Card container and outer box — solid slate-900 on slate-950 body with
    // a soft border. No heavy shadow; the color contrast does the work.
    rootBox: 'w-full',
    cardBox: 'shadow-xl border border-slate-800 rounded-xl overflow-hidden',
    card: 'bg-slate-900 text-slate-50 px-8 py-8 gap-5',

    // Header: title visible, subtitle muted but readable.
    header: 'gap-1',
    headerTitle: 'text-slate-50 text-xl font-semibold',
    headerSubtitle: 'text-slate-400 text-sm',

    // OAuth (Google) block — outlined dark button matching mobile's
    // GoogleSSOButton so the two surfaces look related.
    socialButtons: 'gap-2',
    socialButtonsBlockButton:
      'bg-transparent border border-slate-700 hover:bg-slate-800 text-slate-50 rounded-lg py-3',
    socialButtonsBlockButtonText: 'text-slate-50 font-semibold',

    // Divider between OAuth and email form.
    dividerRow: 'my-2',
    dividerLine: 'bg-slate-800',
    dividerText: 'text-slate-500 text-xs uppercase tracking-wider',

    // Form inputs and labels.
    formFieldLabel: 'text-slate-300 text-sm font-medium',
    formFieldInput:
      'bg-slate-800 border border-slate-700 text-slate-50 rounded-lg placeholder:text-slate-500 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600',
    formFieldInputShowPasswordButton: 'text-slate-400 hover:text-slate-200',
    formFieldErrorText: 'text-red-500 text-sm',
    formFieldHintText: 'text-slate-400 text-xs',

    // Primary submit button.
    formButtonPrimary:
      'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg py-3 normal-case',

    // Footer "Don't have an account? Sign up" strip.
    footer: 'bg-transparent',
    footerAction: 'text-slate-400 text-sm',
    footerActionText: 'text-slate-400',
    footerActionLink: 'text-emerald-500 hover:text-emerald-400 font-medium',

    // Error alerts (e.g. wrong password).
    alertText: 'text-red-400',

    // Identity preview (shown on verification stage — "alice@example.com  Edit").
    identityPreviewText: 'text-slate-300',
    identityPreviewEditButton: 'text-emerald-500 hover:text-emerald-400',

    // OTP code entry cells (email verification).
    otpCodeFieldInput:
      'bg-slate-800 border border-slate-700 text-slate-50 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600',
  },
};
