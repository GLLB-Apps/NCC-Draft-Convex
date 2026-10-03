import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'

// E-post/lösenord via Convex Auth — närmast nuvarande Appwrite-flöde
// (account.createEmailPasswordSession). Själbregistrering (Password-
// providerns default profile()) ger bara {email}: inget role/intranet_member
// sätts, precis som Auth::signUp i PHP-versionen — kontot väntar på att en
// superadmin ger det åtkomst (se users.ts: setAccess).
//
// Lösenordsåterställning används INTE via Convex Auths inbyggda flöde —
// AdminResetPassword.tsx förväntar sig PHP-versionens egna token-i-länk-form,
// porterad i passwordReset.ts. Rate limiting på inloggningsförsök (PHP:
// 5/15 min per e-post, 20/IP) saknas här — en medveten, accepterad lucka för
// en liten lågtrafik-sajt (se MIGRATION_PLAN.md §8).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
})
