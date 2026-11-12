This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Collegamento BGT Match

Il percorso server `/api/integrations/bgt-match` accetta solo POST firmati con
`BGT_MATCH_HMAC_KEY` (segreto di produzione, mai NEXT_PUBLIC). Firma SHA-256 HMAC:
`POST\n/api/integrations/bgt-match\n<TIMESTAMP>\n<JSON esatto>`; validità 5 minuti.
Solo Palazzetto (50 €/ora) e Tendone (40 €/ora), calcetto, durate 60/90 minuti,
orizzonte 90 giorni. BGT può applicare una sua offerta a prezzo inferiore.
Le tariffe ordinarie non cambiano. Il pagamento avviene al centro.

L'ID UUID della richiesta è la chiave della prenotazione: i retry non creano duplicati.
La provenienza `BGT_MATCH:<identificativo pseudonimo>` permette di leggere solo le
prenotazioni dello stesso account. Le prenotazioni compaiono nel calendario
amministratore normale; spostamenti nello stesso campo mantengono il prezzo
concordato, proporzionato alla durata. Cancellazioni e spostamenti sono gestiti
nel gestionale del centro e riletti da BGT Match.

Ordine di rilascio: pubblicare codice server con `SUPABASE_SERVICE_ROLE_KEY` e
sessione amministratore firmata; verificare API pubbliche e rifiuto di cookie
contraffatti; applicare la migrazione `bgt_booking_access_and_calendar_guard`;
verificare protezioni e conflitti; infine abilitare il collegamento in BGT Match.
Il vecchio cookie admin viene invalidato: accedere di nuovo con la password abituale.
Non ripristinare una versione che usa la chiave anon dopo aver attivato le RLS.

Verifica locale: `node tests/bgt-integration.mjs`, `node tests/bgt-endpoint.mjs`,
`npx tsc --noEmit`, `npm run build` con variabili di build di test.
I test usano dati fittizi e non inviano email o prenotazioni reali.
