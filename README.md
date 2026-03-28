# AGNT Station — AI Agent Control Panel

> "Lovable för AI-agenter" — En prompt in → en färdig, fungerande agent ut.

## Vad är detta?

AGNT Station är en lokal kontrollpanel (localhost) för Windows som låter dig:
- **Skapa AI-agenter med en enda prompt** — beskriv vad du vill, systemet bygger hela agenten
- **Styra din dator** — WiFi, restart, processer, disk via PowerShell
- **TikTok-automation** — posta content, scrapa trender, DM-outreach
- **WhatsApp Business** — notifikationer, rapporter, kundkommunikation
- **Email** — SMTP/IMAP via Gmail
- **Multi-model AI** — Codex/GPT-5, Claude, Groq, Ollama (lokal)

## Tech Stack

| Lager | Teknologi |
|-------|-----------|
| Frontend | Next.js 14 + React + Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes + Node.js |
| AI Builder | OpenAI Responses API + Agents SDK (codex-mini-latest) |
| Agent Runtime | OpenAI Agents SDK (TypeScript) |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| System | PowerShell via child_process |
| TikTok | Content Posting API (officiell) + Playwright (scraping) |
| WhatsApp | WhatsApp Cloud API (Meta) |
| Email | Nodemailer (SMTP) |
| Dashboard | react-grid-layout |
| Cron | node-cron |

## Snabbstart

```bash
# 1. Klona projektet
git clone <repo-url>
cd agnt-station

# 2. Installera dependencies
npm install

# 3. Kopiera env-filen och fyll i dina API-nycklar
cp .env.example .env

# 4. Initiera databasen
npm run db:push

# 5. Starta dev-server
npm run dev
```

Öppna http://localhost:3000

## Projektstruktur

```
agnt-station/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Dashboard (startsida)
│   │   ├── agents/             # Agent Hub
│   │   ├── scripts/            # Script Manager
│   │   ├── settings/           # API-inställningar
│   │   └── api/                # Backend API Routes
│   │       ├── agents/         # CRUD + körning av agenter
│   │       ├── builder/        # Meta-agent (bygger nya agenter)
│   │       ├── system/         # PowerShell-kommandon
│   │       ├── tiktok/         # TikTok API integration
│   │       ├── whatsapp/       # WhatsApp Cloud API
│   │       └── email/          # SMTP/IMAP
│   ├── lib/
│   │   ├── ai/                 # AI-klienter och agentruntime
│   │   ├── db/                 # SQLite + Drizzle schema
│   │   ├── integrations/       # TikTok, WhatsApp, Email moduler
│   │   └── system/             # PowerShell-wrappers
│   └── components/             # React UI-komponenter
├── scripts/                    # PowerShell-skript
├── drizzle.config.ts
├── package.json
└── .env.example
```

## Arkitektur

### Agent Builder Flow (Kärnkonceptet)

```
Användare: "Skapa en TikTok-agent som postar varje dag kl 18,
            scrapar trender varje morgon, och skickar mig en
            WhatsApp-rapport varje kväll"
            
                    ↓
            
[Meta-Agent / Builder]  ← Codex (codex-mini-latest)
│
├── 1. Analyserar prompten → identifierar capabilities
│   - content_posting (TikTok API)
│   - trend_scraping (Playwright)
│   - whatsapp_notification
│   - cron_scheduling
│
├── 2. Genererar agent-config (JSON)
│   - system_prompt
│   - tools[]
│   - schedules[]
│   - integrations[]
│
├── 3. Registrerar i databasen
│
├── 4. Skapar cron-jobs
│
└── 5. Agent redo att köra ✅
```

### Multi-Model Support

Varje agent kan använda sin egen modell:
- **OpenAI**: gpt-4o, codex-mini-latest, gpt-5.4-mini
- **Anthropic**: claude-sonnet-4-20250514, claude-opus-4-5
- **Groq**: llama-3.3-70b-versatile (gratis!)
- **Ollama**: llama3:8b (lokal, gratis)

## API-nycklar som behövs

| Service | Var får man den | Kostnad |
|---------|----------------|---------|
| OpenAI | platform.openai.com | ~$5-20/mån |
| Meta WhatsApp | developers.facebook.com | Gratis setup, per-meddelande |
| TikTok Dev | developers.tiktok.com | Gratis |
| Anthropic (valfri) | console.anthropic.com | ~$5-20/mån |
| Groq (valfri) | console.groq.com | Gratis tier |

## Exempelanvändning

### Skapa en TikTok-agent

```
"Skapa en TikTok-agent som postar varje dag kl 18, 
scrapar trender varje morgon, och skickar mig en 
WhatsApp-rapport varje kväll"
```

Systemet genererar automatiskt:
- Agent-namn: "TikTok Growth Agent"
- System prompt för content creation
- Tools: tiktok_post, tiktok_scrape, whatsapp_send
- Schedules: Daily posts @ 18:00, Trend scraping @ 08:00, Reports @ 20:00
- Integrationer: TikTok, WhatsApp

### Systemkontroll

```powershell
# Via UI eller API
- Get disk usage
- List running processes
- Disconnect/connect WiFi
- Restart/shutdown computer
- Execute custom PowerShell scripts
```

## SaaS-redo

Projektet är förberett för multi-tenant:
- Varje användare har sin egen SQLite-databas (eller migrera till PostgreSQL)
- API-nycklar lagras krypterat per användare
- Agent-configs är portabla (export/import JSON)
- Webhook-baserad arkitektur för skalbarhet

## Nästa steg för production

1. **Auth**: Implementera NextAuth för användarinloggning
2. **Database**: Migrera från SQLite → PostgreSQL
3. **Payments**: Integrera Stripe för subscription
4. **Cron**: Sätt upp node-cron för scheduled tasks
5. **Deploy**: Railway, Vercel, eller egen server

## License

MIT
