// Add these at the top
const express = require('express');
const qrcode = require('qrcode');
const app = express();
let lastQR = '';

app.get('/', (req, res) => {
  if (lastQR) {
    qrcode.toDataURL(lastQR, (err, url) => {
      res.send(`<img src="${url}" /><p>Scan this with WhatsApp</p>`);
    });
  } else {
    res.send('Bot is already authenticated or QR not ready yet. Refresh in 10 seconds.');
  }
});

app.listen(3000, () => console.log('QR server running on port 3000'));

// Then change the QR event to:
client.on('qr', (qr) => {
  lastQR = qr;
  console.log('QR ready — visit your Render URL to scan it');
});

/**
 * WhatsApp AI Bot — Powered by Claude (via Anthropic API)
 * Features:
 *  - Auto-reply 2 mins after receiving a message (if no follow-up)
 *  - Auto-view & react to statuses (emoji matches mood of post)
 *  - Auto-reply to statuses (empathetic or motivating)
 *  - Monday morning greetings to all contacts (safe, staggered)
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Anthropic = require('@anthropic-ai/sdk');
const cron = require('node-cron');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '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';
const AUTO_REPLY_DELAY_MS = 2 * 60 * 1000; // 2 minutes
const STATUS_REPLY_ENABLED = true;
const MONDAY_GREETING_ENABLED = true;

// Anti-ban: delay between bulk messages (ms). Keep between 8–20s randomly
const MIN_BULK_DELAY = 8000;
const MAX_BULK_DELAY = 20000;

// ─── INIT ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'whatsapp-ai-bot' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// Tracks pending auto-replies: contactId -> timeout handle
const pendingReplies = new Map();

// ─── QR & READY ────────────────────────────────────────────────────────────
client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with your WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp bot is live and ready!');
  scheduleMondayGreetings();
});

client.on('auth_failure', () => console.error('❌ Auth failed. Delete .wwebjs_auth and retry.'));

// ─── CLAUDE HELPER ─────────────────────────────────────────────────────────
async function askClaude(systemPrompt, userMessage) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  return res.content[0].text.trim();
}

// ─── AUTO REPLY ────────────────────────────────────────────────────────────
client.on('message', async (msg) => {
  // Ignore group chats, status broadcasts, and your own messages
  if (msg.isGroupMsg || msg.from === 'status@broadcast' || msg.fromMe) return;

  const contactId = msg.from;

  // Cancel previous pending reply for this contact (they sent another msg)
  if (pendingReplies.has(contactId)) {
    clearTimeout(pendingReplies.get(contactId));
  }

  // Schedule reply after 2 mins of silence
  const timer = setTimeout(async () => {
    pendingReplies.delete(contactId);
    try {
      const contact = await msg.getContact();
      const name = contact.pushname || 'there';

      const reply = await askClaude(
        `You are a friendly, casual WhatsApp assistant replying on behalf of the phone owner.
         Be warm, natural, and concise — like a real human texting. 
         Don't use bullet points. Keep it to 1–3 sentences max.
         The contact's name is "${name}".`,
        `The contact sent: "${msg.body}"\n\nWrite a friendly reply.`
      );

      await client.sendMessage(contactId, reply);
      console.log(`💬 Auto-replied to ${name} (${contactId})`);
    } catch (err) {
      console.error('Auto-reply error:', err.message);
    }
  }, AUTO_REPLY_DELAY_MS);

  pendingReplies.set(contactId, timer);
});

// ─── STATUS WATCHER ────────────────────────────────────────────────────────
client.on('message', async (msg) => {
  if (msg.from !== 'status@broadcast') return;

  const statusText = msg.body || '';
  const contactId = msg.author || msg.from;

  try {
    // 1. Auto-view the status
    await msg.getChat(); // triggers "seen"

    // 2. Determine mood + reaction emoji via Claude
    const moodResponse = await askClaude(
      `Analyze the emotional tone of this WhatsApp status update.
       Reply with ONLY a JSON object like: {"mood": "sad|happy|angry|motivated|neutral|misery", "emoji": "😢"}
       Pick one emoji that genuinely matches the mood. For misery/sadness use 😢 or 💔. For happy use 😂 or ❤️. For motivational use 🔥 or 💪.`,
      statusText || '[Media status — no text]'
    );

    let emoji = '❤️';
    let mood = 'neutral';
    try {
      const parsed = JSON.parse(moodResponse);
      emoji = parsed.emoji || '❤️';
      mood = parsed.mood || 'neutral';
    } catch (_) {}

    // 3. React to the status
    try {
      await msg.react(emoji);
      console.log(`👍 Reacted to status from ${contactId} with ${emoji} (mood: ${mood})`);
    } catch (_) {
      // React not always supported on status; silently skip
    }

    // 4. Reply to the status if enabled
    if (STATUS_REPLY_ENABLED) {
      const replyTone =
        mood === 'sad' || mood === 'misery' || mood === 'angry'
          ? 'empathetic and matching their energy — acknowledge their pain, be real'
          : 'uplifting, warm, and motivating';

      const statusReply = await askClaude(
        `You're replying to someone's WhatsApp status. 
         Tone: ${replyTone}. 
         Be genuine, short (1–2 sentences), human — NOT generic or preachy.
         Don't start with "I" or "Hey". Just dive in.`,
        `Their status says: "${statusText || '[media content]'}"`
      );

      await client.sendMessage(contactId, statusReply);
      console.log(`💬 Replied to status from ${contactId}`);
    }
  } catch (err) {
    console.error('Status handler error:', err.message);
  }
});

// ─── MONDAY GREETINGS ──────────────────────────────────────────────────────
function scheduleMondayGreetings() {
  if (!MONDAY_GREETING_ENABLED) return;

  // Every Monday at 8:00 AM
  cron.schedule('0 8 * * 1', async () => {
    console.log('📅 Monday! Sending greetings to all contacts...');
    await sendMondayGreetings();
  });
}

async function sendMondayGreetings() {
  try {
    const contacts = await client.getContacts();
    // Filter: only saved contacts with a name and valid WhatsApp number
    const validContacts = contacts.filter(
      (c) => c.isMyContact && c.pushname && !c.isGroup && !c.isMe && c.id.server === 'c.us'
    );

    console.log(`📬 Sending Monday greetings to ${validContacts.length} contacts...`);

    for (const contact of validContacts) {
      try {
        const name = contact.pushname.split(' ')[0]; // First name only

        // Generate a unique, short greeting (anti-ban: varied messages)
        const greeting = await askClaude(
          `Write a short, warm Monday morning WhatsApp greeting for someone named ${name}.
           Rules:
           - Max 2 sentences
           - Casual and genuine, not corporate
           - Slightly different each time (don't be formulaic)
           - Don't use emojis excessively — max 1 emoji
           - Don't mention God, religion, or anything potentially offensive
           - Sound like a real friend, not a bot`,
          `Generate a unique Monday greeting for ${name}.`
        );

        await client.sendMessage(contact.id._serialized, greeting);
        console.log(`✅ Greeted ${name}`);

        // Anti-ban delay: random pause between messages
        const delay = MIN_BULK_DELAY + Math.random() * (MAX_BULK_DELAY - MIN_BULK_DELAY);
        await sleep(delay);
      } catch (err) {
        console.error(`Failed to greet ${contact.pushname}:`, err.message);
        await sleep(5000); // short pause on error then continue
      }
    }

    console.log('🎉 Monday greetings done!');
  } catch (err) {
    console.error('Monday greeting error:', err.message);
  }
}

// ─── UTILS ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── START ─────────────────────────────────────────────────────────────────
client.initialize();
