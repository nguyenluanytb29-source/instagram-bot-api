// server.js - FINAL COMPLETE VERSION
// All fixes: No greeting repeat + Modell info ONCE only + Split messages
// v2 fixes: Cross-day conversation continuity + Smart context summary + Model upgrade

const express = require('express');
const { Pool } = require('pg');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// System prompt
const SYSTEM_PROMPT = `Du bist der KI-Assistent von Nailounge101 Berlin (Reichsstraße 101, 14052 Berlin).

🔴🔴🔴 KRITISCHE REGEL - NIEMALS WIEDERHOLEN 🔴🔴🔴

Chat history format:
[user]: message
[assistant]: response

WENN du [assistant] Nachrichten in der History siehst:
→ Du hast SCHON gegrüßt
→ NIEMALS "Guten Tag", "Hallo", "Willkommen" nochmal sagen
→ Antworte DIREKT auf die Frage
→ Maximal 2-3 Sätze

WENN Chat History LEER ist:
→ NUR DANN: "Guten Tag! Willkommen bei Nailounge101 Berlin. Wie kann ich helfen, bitte?"

BUCHUNG (NORMALE KUNDEN):

🔗 TERMIN-ANFRAGE (SEHR WICHTIG!):

Wenn Kunde fragt nach Termin (beliebige Form):
- "Ich möchte einen Termin"
- "Termin buchen"
- "Kann ich buchen?"
- "ja" (nach Preis-Frage → bedeutet will buchen)

→ IMMER ZUERST Setmore Link geben:

"Gerne! Sie können online buchen: https://nailounge101.setmore.com/

Oder sagen Sie mir einfach Ihren Wunschtermin (Tag und Uhrzeit), dann helfe ich Ihnen gerne, bitte!"

⚠️ KRITISCH:
- IMMER Link bei Termin-Anfrage geben
- NICHT nur fragen: "Welcher Tag passt Ihnen?"
- NICHT nur sagen: "Sagen Sie mir Tag und Uhrzeit"
- ZUERST Link, DANN manuelle Option

⏰ ÖFFNUNGSZEITEN:
Montag - Freitag: 09:30 - 19:00 Uhr
Samstag: 09:30 - 16:00 Uhr
Sonntag: Geschlossen

🕐 ZEIT-FORMATE ERKENNEN:
Diese Formate bedeuten ALLE eine Uhrzeit:
- "4h" = Uhrzeit (16:00 oder 04:00)
- "14h" = Uhrzeit (14:00)
- "3h" = Uhrzeit (15:00 oder 03:00)
- "4" = Uhrzeit im Termin-Kontext
- "14" = Uhrzeit (14:00)
- "9:30" = Uhrzeit (09:30)
- "14 Uhr" = Uhrzeit (14:00)
- "um 14" = Uhrzeit (14:00)

📋 BUCHUNGS-ABLAUF:

SCHRITT 1 - Termin-Anfrage:
User: "Ich möchte einen Termin" / "Termin buchen" / "ja"
→ "Gerne! Sie können online buchen: https://nailounge101.setmore.com/
   Oder sagen Sie mir Ihren Wunschtermin (Tag und Uhrzeit), dann helfe ich Ihnen gerne, bitte!"

SCHRITT 2 - Kunde nennt NUR Tag:
User: "Montag" / "monday" / "Samstag"
→ "Perfekt! Welche Uhrzeit am Montag passt Ihnen, bitte?"

SCHRITT 3 - Kunde nennt Uhrzeit:

📋 ÖFFNUNGSZEITEN-CHECK:

A) MONTAG - FREITAG (09:30 - 19:00):

Innerhalb 09:30-19:00:
User: "Montag 10h" / "Dienstag 14h" / "Freitag 18h" / "18h"
→ "Perfekt! Bitte warten Sie kurz, unsere Mitarbeiter prüfen die Verfügbarkeit und erstellen Ihren Termin. Vielen Dank, bitte!"

⚠️ WICHTIG: 18h = OK (vor 19:00), 19h = NICHT OK (ab 19:00 geschlossen)

Außerhalb (vor 09:30 oder ab 19:00):
User: "Montag 8h" / "Dienstag 19h" / "Freitag 20h" / "3h" / "8h"
→ "Entschuldigung, wir sind Mo-Fr von 09:30 bis 19:00 Uhr geöffnet. Welche Uhrzeit zwischen 09:30 und 19:00 Uhr passt Ihnen, bitte?"

---

B) SAMSTAG (09:30 - 16:00):

Innerhalb 09:30-16:00:
User: "Samstag 10h" / "Samstag 14h" / "Sa 15h" / "Sa 12h"
→ "Perfekt! Bitte warten Sie kurz, unsere Mitarbeiter prüfen die Verfügbarkeit und erstellen Ihren Termin. Vielen Dank, bitte!"

⚠️ WICHTIG: 15h = OK, 15:30 = OK, 16h = NICHT OK (ab 16:00 geschlossen)

Außerhalb (vor 09:30 oder ab 16:00):
User: "Samstag 8h" / "Samstag 16h" / "Sa 17h" / "Sa 20h"
→ "Entschuldigung, wir sind am Samstag von 09:30 bis 16:00 Uhr geöffnet. Welche Uhrzeit zwischen 09:30 und 16:00 Uhr passt Ihnen, bitte?"

---

C) SONNTAG (GESCHLOSSEN):

User: "Sonntag" / "Sonntag 14h" / "So" / "So 10h"
→ "Entschuldigung, wir sind am Sonntag geschlossen. Möchten Sie einen Termin von Montag bis Samstag, bitte?"

---

D) WENN TAG NICHT GENANNT:

User sagt nur Uhrzeit ohne Tag (z.B. "14h" ohne Tag davor):
→ Annehmen es ist Mo-Fr
→ Check gegen 09:30-19:00

⚠️ WICHTIGE REGELN:

1. Bei Termin-Anfrage → IMMER Link geben
   ✗ FALSCH: "Welcher Tag passt Ihnen?"
   ✓ RICHTIG: "Gerne! Online: https://nailounge101.setmore.com/ Oder..."

2. "4h", "14h", "3h" = UHRZEIT
   - Wenn Tag schon genannt → SOFORT "Mitarbeiter prüfen"
   - NICHT nochmal fragen

3. Prüfe Öffnungszeiten:
   - Mo-Fr: 09:30-19:00
   - Sa: 09:30-16:00
   - So: Geschlossen

4. NICHT selbst buchen
   ✗ FALSCH: "Termin ist gebucht"
   ✓ RICHTIG: "Mitarbeiter prüfen"

📝 BEISPIELE:

User: "Ich möchte einen Termin"
✓ "Gerne! Sie können online buchen: https://nailounge101.setmore.com/
   Oder sagen Sie mir Ihren Wunschtermin..."
✗ FALSCH: "Welcher Tag passt Ihnen?" (OHNE Link!)

User: "ja" (nach "Möchten Sie Termin?")
✓ "Gerne! Online: https://nailounge101.setmore.com/ Oder sagen Sie..."
✗ FALSCH: "Sagen Sie mir Tag und Uhrzeit" (OHNE Link!)

User: "Termin buchen"
✓ "Gerne! https://nailounge101.setmore.com/ Oder sagen Sie..."

User: "Montag"
✓ "Perfekt! Welche Uhrzeit am Montag?"

User: "4h"
✓ "Perfekt! Mitarbeiter prüfen die Verfügbarkeit. Vielen Dank!"
✗ FALSCH: "Welche Uhrzeit?"

User: "14h"
✓ "Perfekt! Mitarbeiter prüfen..."

User: "3h"
✓ "Entschuldigung, wir sind Mo-Fr 09:30-19:00. Welche Uhrzeit..."
(03:00 ist außerhalb)

User: "9:30"
✓ "Perfekt! Mitarbeiter prüfen..."

User: "Samstag 14h"
✓ "Perfekt! Mitarbeiter prüfen..."

User: "Samstag 17h"
✓ "Entschuldigung, Sa 09:30-16:00. Welche Uhrzeit..."

User: "Sonntag 14h"
✓ "Entschuldigung, Sonntag geschlossen. Mo-Sa Termin?"
User: "Samstag 10h"
✓ "Perfekt! Mitarbeiter prüfen die Verfügbarkeit. Vielen Dank!"

User: "Samstag 14h"  
✓ "Perfekt! Mitarbeiter prüfen..."

User: "Samstag 17h"
✓ "Entschuldigung, wir sind am Samstag von 09:30 bis 16:00 Uhr geöffnet. Welche Uhrzeit zwischen 09:30 und 16:00 Uhr passt Ihnen, bitte?"

User: "Sa 8h"
✓ "Entschuldigung, Sa 09:30-16:00. Welche Uhrzeit..."

User: "Sa 15h"
✓ "Perfekt! Mitarbeiter prüfen..."

📝 BEISPIELE MIT SAMSTAG (SEHR WICHTIG!):

User: "Samstag"
✓ "Perfekt! Welche Uhrzeit am Samstag passt Ihnen, bitte?"

User: "Samstag 10h"
✓ "Perfekt! Bitte warten Sie kurz, unsere Mitarbeiter prüfen die Verfügbarkeit. Vielen Dank!"

User: "Samstag 14h"
✓ "Perfekt! Mitarbeiter prüfen die Verfügbarkeit. Vielen Dank!"

User: "Samstag 15h"
✓ "Perfekt! Mitarbeiter prüfen..."

User: "Samstag 15:30"
✓ "Perfekt! Mitarbeiter prüfen..."

User: "Samstag 16h"
✓ "Entschuldigung, wir sind am Samstag von 09:30 bis 16:00 Uhr geöffnet. Welche Uhrzeit zwischen 09:30 und 16:00 Uhr passt Ihnen, bitte?"

User: "Samstag 17h"
✓ "Entschuldigung, wir sind am Samstag von 09:30 bis 16:00 Uhr geöffnet. Welche Uhrzeit..."

User: "Sa 8h"
✓ "Entschuldigung, Sa 09:30-16:00. Welche Uhrzeit..."

User: "Sa 12h"
✓ "Perfekt! Mitarbeiter prüfen..."


📝 BEISPIELE MIT 18H (MONTAG-FREITAG):

User: "18h"
✓ "Perfekt! Bitte warten Sie kurz, unsere Mitarbeiter prüfen die Verfügbarkeit. Vielen Dank!"
✗ FALSCH: "Wir sind 09:30-19:00..." (18h ist VOR 19:00!)

User: "Montag 18h"
✓ "Perfekt! Mitarbeiter prüfen..."

User: "18:30"
✓ "Perfekt! Mitarbeiter prüfen..."

User: "18:45"
✓ "Perfekt! Mitarbeiter prüfen..."

User: "19h"
✓ "Entschuldigung, wir sind Mo-Fr von 09:30 bis 19:00 Uhr geöffnet..."

❌ HÄUFIGE FEHLER:

User: "Ich möchte einen Termin"
✗ FALSCH: "Welcher Tag passt Ihnen?" (Link vergessen!)
✗ FALSCH: "Bitte sagen Sie Tag und Uhrzeit" (Link vergessen!)
✓ RICHTIG: "Gerne! https://nailounge101.setmore.com/ Oder..."

User: "ja" nach Preis
✗ FALSCH: "Sagen Sie mir Wunschtermin" (Link vergessen!)
✓ RICHTIG: "Gerne! https://nailounge101.setmore.com/ Oder..."

User: "4h" nach Tag
✗ FALSCH: "Welche Uhrzeit passt Ihnen?"
✓ RICHTIG: "Perfekt! Mitarbeiter prüfen..."

GRUNDREGELN:
- Antworte auf Hochdeutsch, warm, professionell
- Maximal 2-3 Sätze
- Mindestens 1× "bitte"

PREISE:
Maniküre: ohne 15€, Nagellack 25€, Shellac 35€
Neumodellage: Natur 30€, Farbe 35€, French 38€, Ombre 38€
Pediküre: Basic ohne 28€, Advanced ohne 33€, Luxus ohne 38€
Reparatur: Nagel 5€, Ablösen 10-20€

WICHTIG:
- Prüfe ob [assistant] in History ist
- Wenn JA → KEIN Gruß
- Beziehe dich auf Chat History
- Keine Wiederholungen`;

// Modell text - split into 3 parts
const MODELL_PART_1 = `Guten Tag! Wir freuen uns sehr, dass Sie sich für unsere Dienstleistungen interessieren.

Momentan nehmen wir noch Kunden für unsere Schüler an.`;

const MODELL_PART_2 = `Der Preis für die Nägel hängt vom Design ab:
- Natur klar: 15 Euro
- Natur Make-up, French, Farbe, Glitzer, Ombre oder Katzenaugen: 20 Euro  
- Aufwendige Designs: +1 Euro pro Design-Nagel
- Steinchen: 0,50 Euro pro Stück

Unsere Schüler können sehr komplizierte Muster möglicherweise nicht umsetzen.`;

const MODELL_PART_3 = `Die Behandlungszeit beträgt etwa 2-3 Stunden, und das Ergebnis kann möglicherweise nicht perfekt sein — wir möchten Sie im Voraus darüber informieren.

Nachbesserung innerhalb von 3 Tagen inklusive!

Ist das für Sie in Ordnung? 💅`;

// Check if message contains Modellkunde keywords
function hasModellKeyword(text) {
  if (!text) return false;
  const keywords = ['modell', 'model', 'azubi', 'übung', 'training', 'schulung', '15euro', '15 euro', '15 €', '15€'];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

// Check if should send Modell info (ONLY ONCE per conversation)
function isModellkundeConversation(userMessage, history) {
  // Step 1: Check if current message has Modell keyword
  const hasKeyword = hasModellKeyword(userMessage);

  if (!hasKeyword) {
    console.log('✗ No Modell keyword in current message');
    return false;
  }

  console.log('✓ Modell keyword found in current message');

  // Step 2: Check if we ALREADY sent Modell info in this conversation
  if (history && history.length > 0) {
    const alreadySentModellInfo = history.some(msg =>
      msg.role === 'assistant' &&
      msg.message.includes('Wir freuen uns sehr')
    );

    if (alreadySentModellInfo) {
      console.log('✗ Modell info already sent in this conversation - NOT sending again');
      return false;
    }
  }

  console.log('✓ First time Modell keyword detected - WILL send Modell info');
  return true;
}

// Initialize database
async function initDB() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS chat_history (
      id SERIAL PRIMARY KEY,
      contact_id VARCHAR(255) NOT NULL,
      user_name VARCHAR(255),
      role VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // NEW: Table to store conversation summary per customer (cross-day memory)
  const createSummaryTableQuery = `
    CREATE TABLE IF NOT EXISTS conversation_summary (
      id SERIAL PRIMARY KEY,
      contact_id VARCHAR(255) UNIQUE NOT NULL,
      user_name VARCHAR(255),
      summary TEXT NOT NULL,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  try {
    await pool.query(createTableQuery);
    await pool.query(createSummaryTableQuery);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database init error:', error);
  }
}

// Get chat history - increased LIMIT from 20 to 50 for cross-day continuity
async function getChatHistory(contactId) {
  const query = `
    SELECT role, message, timestamp
    FROM chat_history
    WHERE contact_id = $1
    ORDER BY timestamp DESC
    LIMIT 50
  `;

  try {
    const result = await pool.query(query, [contactId]);
    return result.rows.reverse();
  } catch (error) {
    console.error('❌ Get history error:', error);
    return [];
  }
}

// NEW: Get stored summary for a customer (cross-day memory)
async function getConversationSummary(contactId) {
  const query = `
    SELECT summary, last_updated
    FROM conversation_summary
    WHERE contact_id = $1
  `;
  try {
    const result = await pool.query(query, [contactId]);
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('❌ Get summary error:', error);
    return null;
  }
}

// NEW: Save or update conversation summary using AI
// After each conversation, AI summarizes key info so bot remembers across days
async function updateConversationSummary(contactId, userName, history) {
  // Only summarize if there are enough messages
  if (!history || history.length < 4) return;

  try {
    // Get existing summary to build on it
    const existing = await getConversationSummary(contactId);
    const existingSummaryText = existing
      ? `Bisherige Zusammenfassung (von früher): ${existing.summary}\n\n`
      : '';

    // Only use last 20 messages for summarization to save tokens
    const recentHistory = history.slice(-20);
    const historyText = recentHistory
      .map(msg => `[${msg.role}]: ${msg.message.replace(/\n/g, ' ')}`)
      .join('\n');

    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Assistent, der Kundengespräche für einen Nagelstudio-Bot zusammenfasst.
Erstelle eine kompakte Zusammenfassung auf Deutsch, die folgende Infos enthält (wenn vorhanden):
- Was der Kunde gefragt/gewünscht hat
- Welche Dienstleistungen besprochen wurden
- Ob ein Termin vereinbart wurde (Tag, Uhrzeit)
- Ob der Kunde ein Modellkunde ist
- Besondere Wünsche oder Präferenzen
- Aktueller Status (z.B. "wartet auf Bestätigung", "Termin gebucht", "fragt nach Preis")
Maximal 5 Sätze. Nur die wichtigsten Infos.`
        },
        {
          role: 'user',
          content: `${existingSummaryText}Neueste Gesprächshistorie:\n${historyText}\n\nBitte erstelle eine aktualisierte Zusammenfassung.`
        }
      ],
      max_tokens: 300,
      temperature: 0.3
    });

    const newSummary = summaryCompletion.choices[0].message.content;

    // Upsert: insert new or update existing summary
    const upsertQuery = `
      INSERT INTO conversation_summary (contact_id, user_name, summary, last_updated)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (contact_id)
      DO UPDATE SET summary = $3, user_name = $2, last_updated = CURRENT_TIMESTAMP
    `;
    await pool.query(upsertQuery, [contactId, userName, newSummary]);
    console.log(`✅ Summary updated for ${contactId}`);
  } catch (error) {
    console.error('❌ Update summary error:', error.message);
    // Non-critical: bot continues working even if summary update fails
  }
}

// Save message
async function saveMessage(contactId, userName, role, message) {
  const query = `
    INSERT INTO chat_history (contact_id, user_name, role, message)
    VALUES ($1, $2, $3, $4)
  `;

  try {
    await pool.query(query, [contactId, userName, role, message]);
    console.log(`✅ Saved ${role} message`);
  } catch (error) {
    console.error(`❌ Save ${role} message error:`, error.message);
  }
}

// Format history
function formatHistory(history) {
  if (!history || history.length === 0) {
    return "No previous conversation.";
  }

  return history
    .map(msg => {
      const cleanMessage = msg.message.replace(/"/g, "'").replace(/\n/g, " ");
      return `[${msg.role}]: ${cleanMessage}`;
    })
    .join('\n');
}

// Main chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { contact_id, user_name, user_message } = req.body;

    if (!contact_id || !user_message) {
      return res.status(400).json({
        error: 'Missing contact_id or user_message'
      });
    }

    console.log(`📩 New message from ${user_name} (${contact_id}): ${user_message}`);

    // 1. Get chat history (now up to 50 messages)
    const history = await getChatHistory(contact_id);
    const historyText = formatHistory(history);

    console.log(`📚 Found ${history.length} previous messages`);

    // NEW: Get long-term summary for this customer (cross-day memory)
    const existingSummary = await getConversationSummary(contact_id);
    let summaryContext = '';
    if (existingSummary) {
      const updatedAt = new Date(existingSummary.last_updated).toLocaleDateString('de-DE');
      summaryContext = `\n📋 KUNDENZUSAMMENFASSUNG (aus früheren Gesprächen, Stand: ${updatedAt}):\n${existingSummary.summary}\n`;
      console.log(`📋 Found existing summary for ${contact_id}`);
    }

    // 2. Check if bot already greeted
    // Search full history (50 msgs) to avoid re-greeting across days
    const hasGreeted = history.some(msg =>
      msg.role === 'assistant' &&
      (msg.message.includes('Guten Tag') || msg.message.includes('Willkommen'))
    );

    // Also treat returning customer (has summary) as already greeted
    const isReturningCustomer = existingSummary !== null;
    const shouldSkipGreeting = hasGreeted || isReturningCustomer;

    if (shouldSkipGreeting) {
      console.log(`✓ Skip greeting - hasGreeted: ${hasGreeted}, isReturning: ${isReturningCustomer}`);
    }

    // 3. Build user message with strong anti-repeat instruction + summary context
    const userContent = shouldSkipGreeting
      ? `${summaryContext}
Chat history (last 50 messages):
${historyText}

---

CURRENT MESSAGE: ${user_message}

---

⚠️ IMPORTANT: You have ALREADY greeted this customer before (see history or summary above).
DO NOT say "Guten Tag", "Hallo", or "Willkommen" again.
${isReturningCustomer && !hasGreeted ? '⚠️ This is a RETURNING CUSTOMER from a previous day. Continue the conversation naturally based on the summary above.' : ''}
Answer the question DIRECTLY.`
      : `${summaryContext}
Chat history (last 50 messages):
${historyText}

---

CURRENT MESSAGE: ${user_message}

---

This is a ${history.length === 0 ? 'NEW' : 'CONTINUING'} conversation. Reply appropriately.`;

    // DEBUG: Check keyword detection
    console.log(`🔍 DEBUG - User message: "${user_message}"`);
    console.log(`🔍 DEBUG - hasModellKeyword: ${hasModellKeyword(user_message)}`);
    console.log(`🔍 DEBUG - History length: ${history.length}`);

    // 4. Call OpenAI - upgraded to gpt-4o for smarter contextual responses
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    // 5. Get AI response
    let aiResponse = completion.choices[0].message.content;
    console.log(`🤖 AI response (original): ${aiResponse.substring(0, 100)}...`);

    // DEBUG: Check AI response content
    console.log(`🔍 DEBUG - AI includes "Wir freuen uns": ${aiResponse.includes('Wir freuen uns sehr')}`);
    console.log(`🔍 DEBUG - AI response length: ${aiResponse.length}`);

    // 6. Check if should send Modell info (ONLY ONCE)
    const shouldSendModellInfo = isModellkundeConversation(user_message, history);

    // DEBUG: Final decision
    console.log(`🔍 DEBUG - shouldSendModellInfo: ${shouldSendModellInfo}`);

    if (shouldSendModellInfo) {
      console.log('🔍 Sending Modell info');

      // Check if bot already greeted
      const alreadyGreeted = history.some(msg =>
        msg.role === 'assistant'
      );

      // Dynamic Part 1 - with or without greeting
      const modellPart1 = alreadyGreeted
        ? `Wir freuen uns sehr, dass Sie sich für unsere Dienstleistungen interessieren.

Momentan nehmen wir noch Kunden für unsere Schüler an.`
        : `Guten Tag! Wir freuen uns sehr, dass Sie sich für unsere Dienstleistungen interessieren.

Momentan nehmen wir noch Kunden für unsere Schüler an.`;

      console.log(`📝 Modell Part 1 ${alreadyGreeted ? 'WITHOUT' : 'WITH'} greeting`);

      // Send 3-part Modell text
      res.json({
        bot_response: modellPart1,
        bot_response_2: MODELL_PART_2,
        bot_response_3: MODELL_PART_3
      });

      // Save messages
      const fullModellText = MODELL_PART_1 + '\n\n' + MODELL_PART_2 + '\n\n' + MODELL_PART_3;
      await saveMessage(contact_id, user_name, 'user', user_message).catch(err => {
        console.error('Failed to save user message:', err.message);
      });
      await saveMessage(contact_id, user_name, 'assistant', fullModellText).catch(err => {
        console.error('Failed to save assistant message:', err.message);
      });

      // Update summary async (non-blocking)
      getChatHistory(contact_id).then(updatedHistory => {
        updateConversationSummary(contact_id, user_name, updatedHistory).catch(err => {
          console.error('Failed to update summary:', err.message);
        });
      });

      return;
    }

    console.log(`🤖 AI response (final): ${aiResponse.substring(0, 100)}... (length: ${aiResponse.length})`);

    // 7. Send normal response (reset _2 and _3 to prevent ManyChat cache)
    res.json({
      bot_response: aiResponse,
      bot_response_2: "",
      bot_response_3: ""
    });

    // 8. Save messages async
    await saveMessage(contact_id, user_name, 'user', user_message).catch(err => {
      console.error('Failed to save user message:', err.message);
    });

    await saveMessage(contact_id, user_name, 'assistant', aiResponse).catch(err => {
      console.error('Failed to save assistant message:', err.message);
    });

    // Update summary async (non-blocking, runs in background)
    getChatHistory(contact_id).then(updatedHistory => {
      updateConversationSummary(contact_id, user_name, updatedHistory).catch(err => {
        console.error('Failed to update summary:', err.message);
      });
    });

  } catch (error) {
    console.error('❌ Error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      bot_response: 'Entschuldigung, es gab einen technischen Fehler. Bitte versuchen Sie es erneut.',
      bot_response_2: "",
      bot_response_3: ""
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint - view history
app.get('/history/:contactId', async (req, res) => {
  try {
    const history = await getChatHistory(req.params.contactId);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NEW: Debug endpoint - view customer summary
app.get('/summary/:contactId', async (req, res) => {
  try {
    const summary = await getConversationSummary(req.params.contactId);
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
