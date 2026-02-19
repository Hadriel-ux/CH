# WhatsApp AI Bot 🤖
Powered by Claude (Anthropic) + whatsapp-web.js

## Features
- 💬 **Auto-reply** — waits 2 mins after last message, then replies as you
- 👀 **Auto-view statuses** — views all contacts' statuses automatically
- 😢 **Smart status reactions** — reacts with an emoji matching the mood (misery = 💔, happy = 😂, etc.)
- 💬 **Status replies** — empathetic for sad posts, motivating for good vibes
- 📅 **Monday greetings** — sends a unique personalised greeting to every contact at 8AM Monday (staggered to avoid bans)

---

## Setup

### 1. Requirements
- Node.js v18+
- A WhatsApp account (personal number)
- Anthropic API key → https://console.anthropic.com

### 2. Install
```bash
cd whatsapp-bot
npm install
```

### 3. Add your API key
Open `index.js` and replace:
```js
const ANTHROPIC_API_KEY = 'YOUR_API_KEY_HERE';
```
Or set it as an environment variable:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Run
```bash
npm start
```
A QR code will appear in your terminal. Scan it with WhatsApp (Linked Devices → Link a Device).

---

## Anti-Ban Safety (Monday Greetings)
- Messages are staggered **8–20 seconds apart** (random delay)
- Each greeting is **unique** (Claude generates a different one per contact)
- Messages are **short** (2 sentences max) — WhatsApp flags mass identical messages
- Only sends to **saved contacts** (not random numbers)

> ⚠️ Still use with caution. WhatsApp can ban automation. Don't send to 1000+ contacts in one go.

---

## Customise
| Setting | Location | Default |
|---|---|---|
| Auto-reply delay | `AUTO_REPLY_DELAY_MS` | 2 mins |
| Status replies on/off | `STATUS_REPLY_ENABLED` | true |
| Monday greetings on/off | `MONDAY_GREETING_ENABLED` | true |
| Greeting time | cron `'0 8 * * 1'` | Mon 8:00 AM |
| Delay between greetings | `MIN_BULK_DELAY / MAX_BULK_DELAY` | 8–20 sec |

---

## Keep it Running (Optional)
Use `pm2` to keep the bot alive in the background:
```bash
npm install -g pm2
pm2 start index.js --name whatsapp-bot
pm2 save
pm2 startup
```
