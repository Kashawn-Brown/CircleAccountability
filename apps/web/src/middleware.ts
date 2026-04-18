import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Clerk middleware runs before any page or route handler on every request.
// By default Clerk treats all routes as public — we have to opt protected
// routes in explicitly. /home and /profile require a signed-in user;
// everything else (/, /sign-in/**, /sign-up/**) stays public.
//
// auth.protect() redirects unauthenticated visitors to the sign-in URL
// configured on the ClerkProvider (see app/layout.tsx). This happens at
// the HTTP level before any React renders — there's no flash of protected
// content, no client-side useAuth race.
const isProtectedRoute = createRouteMatcher(['/home(.*)', '/profile(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Standard Next.js matcher that skips static assets and _next internals.
  // The final line ensures API routes still run through middleware if we
  // ever add them.
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
