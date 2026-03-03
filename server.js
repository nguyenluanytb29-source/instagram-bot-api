// server.js - FINAL COMPLETE VERSION
// v4: New Modellkunde message + Staff takeover (24h pause)

const express = require('express');
const { Pool } = require('pg');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

MODELLKUNDEN - TERMIN BUCHEN:
Wenn MODELLKUNDE "ja" oder "in Ordnung" oder "ok" antwortet (= akzeptiert die Bedingungen):
→ "Perfekt! Bitte buchen Sie hier Ihren Termin: https://nailounge101.setmore.com/book?step=time-slot&products=d8f1cdd3-ca6f-42b7-8f2a-fbbb64cbcd2d&type=service&staff=jeeZoVSakEm9KfPuHaC7ZwfaPN9CKI1R&staffSelected=true"

BUCHUNG (NORMALE KUNDEN):
🔴🔴🔴 KRITISCH - ÖFFNUNGSZEITEN 🔴🔴🔴

MONTAG - FREITAG: 09:30 bis 19:00 Uhr
SAMSTAG: 09:30 bis 16:00 Uhr (NICHT bis 19:00!)
SONNTAG: Geschlossen

⚠️ SAMSTAG IST ANDERS:
- Samstag schließt um 16:00 (NICHT 19:00!)
- "Samstag 17h" = AUSSERHALB
- "Samstag 15h" = OK
- IMMER prüfen ob Tag = Samstag → dann 16:00 statt 19:00

🔗 TERMIN-ANFRAGE (SEHR WICHTIG!):

⚠️ AUSNAHME - MODELLKUNDEN:
Wenn Kunde ein MODELLKUNDE ist (hat schon die Modell-Info bekommen):
→ KEIN normales Setmore Link geben
→ Nur nach Akzeptanz den speziellen Modellkunden-Link geben (siehe oben)

Wenn Kunde ein NORMALER KUNDE ist (kein Modellkunde):
- "Ich möchte einen Termin"
- "Termin buchen"
- "Kann ich buchen?"
- "ja" (nach Preis-Frage → bedeutet will buchen)

→ IMMER ZUERST Setmore Link geben:

"Gerne! Sie können online buchen: https://nailounge101.setmore.com/

Oder sagen Sie mir einfach Ihren Wunschtermin (Tag und Uhrzeit), dann helfe ich Ihnen gerne, bitte!"

⚠️ KRITISCH:
- NORMALE KUNDEN: IMMER Link geben
- MODELLKUNDEN: Nur speziellen Link nach Akzeptanz
- NICHT nur fragen: "Welcher Tag passt Ihnen?" bei NORMALEN Kunden (Link vergessen!)
- ZUERST Link, DANN manuelle Option (nur bei NORMALEN Kunden)

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

⚠️ WICHTIG - VERGANGENE TERMINE:
Wenn ein Termin in der KUNDENZUSAMMENFASSUNG oder Chat History erwähnt wird:
1. Prüfe das AKTUELLE DATUM (siehe oben)
2. Wenn der Termin VOR dem heutigen Datum liegt → Termin ist VORBEI
3. Frage: "Ihr Termin am [Datum] ist bereits vorbei. Möchten Sie einen neuen Termin vereinbaren?"
4. NIEMALS einen vergangenen Termin als "weiterhin notiert" bestätigen

SCHRITT 1 - Termin-Anfrage:
User: "Ich möchte einen Termin" / "Termin buchen" / "ja"
→ "Gerne! Sie können online buchen: https://nailounge101.setmore.com/
   Oder sagen Sie mir Ihren Wunschtermin (Tag und Uhrzeit), dann helfe ich Ihnen gerne, bitte!"

SCHRITT 2 - Kunde nennt NUR Tag:
User: "Montag" / "monday" / "Samstag"
→ "Perfekt! Welche Uhrzeit am Montag passt Ihnen, bitte?"

SCHRITT 3 - Kunde nennt Uhrzeit:

📋 ÖFFNUNGSZEITEN-CHECK:

🔴 SCHRITT 0 - DATUM PRÜFEN (IMMER ZUERST!):
Wenn Kunde ein spezifisches DATUM nennt (z.B. "25/2", "25.2.2026", "Dienstag 25/2"):
1. Vergleiche mit AKTUELLEM DATUM (siehe oben im Context)
2. Wenn das Datum VOR heute liegt:
   → "Entschuldigung, der 25. Februar ist bereits vorbei. Welches Datum ab heute passt Ihnen, bitte?"
   → STOP hier, NICHT weiter zu Öffnungszeiten-Check
3. Nur wenn Datum HEUTE oder IN DER ZUKUNFT liegt → weiter zu A/B/C

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

1. Bei Termin-Anfrage → IMMER Link geben (NUR für NORMALE Kunden)
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

const MODELL_MESSAGE = `Guten Tag!
Wir freuen uns sehr, dass Sie sich für unsere Dienstleistungen interessieren.
Momentan nehmen wir noch Kunden für unsere Schüler an.
Der Preis für die Nägel hängt vom Design ab:
Wenn Sie Natur klar wünschen, beträgt der Preis 15 €.
Wenn Sie Natur Make-up, French, Farbe, Glitzer, Ombre oder Katzenaugen möchten, kostet es 20 €.
Für aufwendigere Designs berechnen wir zusätzlich 1 € pro Design-Nagel,
und jede Steinchen kostet 0,50 €.
Unsere Schüler können jedoch möglicherweise sehr komplizierte Muster nicht umsetzen.
Die Behandlungszeit beträgt in der Regel etwa 2 bis 3 Stunden,
und das Ergebnis kann möglicherweise nicht perfekt sein — wir möchten Sie im Voraus darüber informieren, damit Sie Bescheid wissen.
Außerdem bieten wir eine Nachbesserung innerhalb von 3 Tagen an.
Ist das für Sie in Ordnung? 💅`;

function hasModellKeyword(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  const excludePatterns = ['neumodellage', 'neumodelage', 'neuemodellage'];
  if (excludePatterns.some(pattern => lower.includes(pattern))) {
    return false;
  }
  
  const keywords = ['modell', 'model', 'azubi', 'auzubi', 'übung', 'training', 'schulung', '15euro', '15 euro', '15 €', '15€'];
  return keywords.some(k => lower.includes(k));
}

function isModellkundeConversation(userMessage, history) {
  const hasKeyword = hasModellKeyword(userMessage);
  
  if (!hasKeyword) {
    console.log('✗ No Modell keyword in current message');
    return false;
  }
  
  console.log('✓ Modell keyword found in current message');
  
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

async function isStaffTakeover(contactId) {
  const query = `
    SELECT role, message, timestamp
    FROM chat_history
    WHERE contact_id = $1 AND role = 'staff'
    ORDER BY timestamp DESC
    LIMIT 1
  `;
  
  try {
    const result = await pool.query(query, [contactId]);
    if (result.rows.length === 0) {
      return false;
    }
    
    const lastStaffMessage = result.rows[0];
    const staffTimestamp = new Date(lastStaffMessage.timestamp);
    const now = new Date();
    const hoursSinceStaffReply = (now - staffTimestamp) / (1000 * 60 * 60);
    
    if (hoursSinceStaffReply < 24) {
      console.log(`⚠️ Staff takeover active - ${hoursSinceStaffReply.toFixed(1)}h since staff reply`);
      return true;
    }
    
    console.log(`✓ Staff takeover expired - ${hoursSinceStaffReply.toFixed(1)}h since staff reply`);
    return false;
  } catch (error) {
    console.error('❌ Check staff takeover error:', error);
    return false;
  }
}
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

async function updateConversationSummary(contactId, userName, history) {
  if (!history || history.length < 4) return;

  try {
    const existing = await getConversationSummary(contactId);
    const existingSummaryText = existing
      ? `Bisherige Zusammenfassung (von früher): ${existing.summary}\n\n`
      : '';

    const recentHistory = history.slice(-20);
    const historyText = recentHistory
      .map(msg => `[${msg.role}]: ${msg.message.replace(/\n/g, ' ')}`)
      .join('\n');

    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
  }
}

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

app.post('/chat', async (req, res) => {
  try {
    const { contact_id, user_name, user_message } = req.body;
    
    if (!contact_id || !user_message) {
      return res.status(400).json({ 
        error: 'Missing contact_id or user_message' 
      });
    }
    
    console.log(`📩 New message from ${user_name} (${contact_id}): ${user_message}`);
    
    const staffTakeover = await isStaffTakeover(contact_id);
    if (staffTakeover) {
      console.log('⚠️ Staff takeover active - bot paused for this contact');
      await saveMessage(contact_id, user_name, 'user', user_message);
      return res.json({
        bot_response: "",
        bot_response_2: "EMPTY_RESPONSE",
        bot_response_3: "EMPTY_RESPONSE"
      });
    }
    
    const history = await getChatHistory(contact_id);
    const historyText = formatHistory(history);
    
    console.log(`📚 Found ${history.length} previous messages`);

    const existingSummary = await getConversationSummary(contact_id);
    let summaryContext = '';
    if (existingSummary) {
      const updatedAt = new Date(existingSummary.last_updated).toLocaleDateString('de-DE');
      summaryContext = `\n📋 KUNDENZUSAMMENFASSUNG (aus früheren Gesprächen, Stand: ${updatedAt}):\n${existingSummary.summary}\n`;
      console.log(`📋 Found existing summary for ${contact_id}`);
    }
    
    const hasGreeted = history.some(msg => 
      msg.role === 'assistant' && 
      (msg.message.includes('Guten Tag') || msg.message.includes('Willkommen'))
    );

    const isReturningCustomer = existingSummary !== null;
    const shouldSkipGreeting = hasGreeted || isReturningCustomer;
    
    if (shouldSkipGreeting) {
      console.log(`✓ Skip greeting - hasGreeted: ${hasGreeted}, isReturning: ${isReturningCustomer}`);
    }
    
    const now = new Date();
    const berlinTime = now.toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const dateContext = `🕐 AKTUELLES DATUM & UHRZEIT (Berlin): ${berlinTime}\n`;

    const userContent = shouldSkipGreeting
      ? `${dateContext}${summaryContext}
Chat history (last 50 messages):
${historyText}

---

CURRENT MESSAGE: ${user_message}

---

⚠️ IMPORTANT: You have ALREADY greeted this customer before (see history or summary above).
DO NOT say "Guten Tag", "Hallo", or "Willkommen" again.
${isReturningCustomer && !hasGreeted ? '⚠️ This is a RETURNING CUSTOMER from a previous day. Continue the conversation naturally based on the summary above.' : ''}
Answer the question DIRECTLY.`
      : `${dateContext}${summaryContext}
Chat history (last 50 messages):
${historyText}

---

CURRENT MESSAGE: ${user_message}

---

This is a ${history.length === 0 ? 'NEW' : 'CONTINUING'} conversation. Reply appropriately.`;

    console.log(`🔍 DEBUG - User message: "${user_message}"`);
    console.log(`🔍 DEBUG - hasModellKeyword: ${hasModellKeyword(user_message)}`);
    console.log(`🔍 DEBUG - History length: ${history.length}`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-2025-04-14',
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
    
    let aiResponse = completion.choices[0].message.content;
    console.log(`🤖 AI response (original): ${aiResponse.substring(0, 100)}...`);
    
    console.log(`🔍 DEBUG - AI includes "Wir freuen uns": ${aiResponse.includes('Wir freuen uns sehr')}`);
    console.log(`🔍 DEBUG - AI response length: ${aiResponse.length}`);
    
    const shouldSendModellInfo = isModellkundeConversation(user_message, history);

    console.log(`🔍 DEBUG - shouldSendModellInfo: ${shouldSendModellInfo}`);
    
    if (shouldSendModellInfo) {
      console.log('🔍 Sending Modell info');
      
      const alreadyGreeted = history.some(msg => 
        msg.role === 'assistant'
      );
      
      const modellMessage = alreadyGreeted
        ? MODELL_MESSAGE.replace('Guten Tag!\n', '')
        : MODELL_MESSAGE;
      
      console.log(`📝 Modell message ${alreadyGreeted ? 'WITHOUT' : 'WITH'} greeting`);
      
      res.json({
        bot_response: modellMessage,
        bot_response_2: "EMPTY_RESPONSE",
        bot_response_3: "EMPTY_RESPONSE"
      });
          
      await saveMessage(contact_id, user_name, 'user', user_message).catch(err => {
        console.error('Failed to save user message:', err.message);
      });
      await saveMessage(contact_id, user_name, 'assistant', modellMessage).catch(err => {
        console.error('Failed to save assistant message:', err.message);
      });

      getChatHistory(contact_id).then(updatedHistory => {
        updateConversationSummary(contact_id, user_name, updatedHistory).catch(err => {
          console.error('Failed to update summary:', err.message);
        });
      });
      
      return;
    }
    
    console.log(`🤖 AI response (final): ${aiResponse.substring(0, 100)}... (length: ${aiResponse.length})`);
    
    res.json({
      bot_response: aiResponse,
      bot_response_2: "EMPTY_RESPONSE",
      bot_response_3: "EMPTY_RESPONSE"
    });
    
    await saveMessage(contact_id, user_name, 'user', user_message).catch(err => {
      console.error('Failed to save user message:', err.message);
    });
    
    await saveMessage(contact_id, user_name, 'assistant', aiResponse).catch(err => {
      console.error('Failed to save assistant message:', err.message);
    });

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
      bot_response_2: "EMPTY_RESPONSE",
      bot_response_3: "EMPTY_RESPONSE"
    });
  }
});
app.post('/staff-reply', async (req, res) => {
  try {
    const { contact_id, user_name, staff_message } = req.body;
    
    if (!contact_id || !staff_message) {
      return res.status(400).json({ 
        error: 'Missing contact_id or staff_message' 
      });
    }
    
    console.log(`👤 Staff reply for ${contact_id}: ${staff_message.substring(0, 50)}...`);
    
    await saveMessage(contact_id, user_name, 'staff', staff_message);
    
    res.json({ 
      success: true, 
      message: 'Staff reply saved, bot paused for 24h' 
    });
    
  } catch (error) {
    console.error('❌ Staff reply error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/history/:contactId', async (req, res) => {
  try {
    const history = await getChatHistory(req.params.contactId);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/summary/:contactId', async (req, res) => {
  try {
    const summary = await getConversationSummary(req.params.contactId);
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
