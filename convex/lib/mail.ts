// Till skillnad från PHP-versionen (vars Mailer.php kunde falla tillbaka på
// PHP:s inbyggda mail() helt utan extern tjänst, se server/lib/Mailer.php)
// har Convex ingen motsvarande inbyggd e-postutskickning — RESEND_API_KEY
// är här OBLIGATORISK för varje funktion som skickar e-post (kontaktformulär
// vid "email"/"both"-leverans, lösenordsåterställning, "skicka nytt
// lösenord"), inte valfri. Detta är en verklig driftsskillnad mot både
// Appwrite- och PHP-versionerna — värt att nämna i INSTALL-dokumentationen.
export async function sendMail(args: { to: string; subject: string; text: string; replyTo?: string; from?: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = args.from ?? process.env.MAIL_FROM_ADDRESS ?? 'no-reply@raddarogleskogen.nu'
  if (!apiKey) {
    console.error('RESEND_API_KEY saknas — kan inte skicka e-post. Sätt den i Convex-projektets miljövariabler.')
    return false
  }

  const payload: Record<string, unknown> = { from, to: [args.to], subject: args.subject, text: args.text }
  if (args.replyTo) payload.reply_to = args.replyTo

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    // Tillfällig diagnostik — Resends faktiska felsvar (ogiltig nyckel,
    // overifierad avsändardomän m.m.) syntes annars aldrig, bara "misslyckades".
    console.error(`[mail] Resend ${res.status}: ${await res.text().catch(() => '(kunde inte läsa svarskroppen)')}`)
  }
  return res.ok
}
