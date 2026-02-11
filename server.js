// server.js - Instagram AI Bot API with Memory
// Tech stack: Node.js + Express + PostgreSQL + OpenAI

const express = require('express');
const { Pool } = require('pg');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// System prompt (German)
// OPTIMIZED SYSTEM PROMPT - NO REPETITION

// FINAL SOLUTION - TEMPLATE-BASED MODELLKUNDE TEXT

const SYSTEM_PROMPT = `Du bist der KI-Assistent von Nailounge101 Berlin (Reichsstraße 101, 14052 Berlin).

⚠️ WICHTIGSTE REGEL - KEINE WIEDERHOLUNGEN:
Wenn Chat History vorhanden ist (mindestens 1 vorherige Nachricht):
→ NIEMALS "Guten Tag", "Hallo", "Willkommen" sagen
→ DIREKT antworten ohne Begrüßung
→ Maximal 2 Sätze

Wenn Chat History LEER ist (erste Nachricht):
→ Nur dann: "Guten Tag! Willkommen bei Nailounge101 Berlin. Wie kann ich helfen, bitte?"

GRUNDREGELN:
- Antworte auf Hochdeutsch, warm, professionell
- Maximal 2-3 Sätze (AUSSER Template-Antworten!)
- Mindestens 1× "bitte"
- Öffnungszeiten: Mo-Fr 09:30-19:00, Sa 09:30-16:00, So geschlossen

🔴🔴🔴 TEMPLATE-ANTWORTEN (VERWENDE GENAU SO!) 🔴🔴🔴

TEMPLATE 1: MODELLKUNDEN-INFO
Verwende dieses Template wenn User sagt: modell, model, azubi, übung, training, schulung, 15euro, 15 euro

{{MODELLKUNDEN_TEMPLATE}}
Guten Tag

Wir freuen uns sehr, dass Sie sich für unsere Dienstleistungen interessieren.

Momentan nehmen wir noch Kunden für unsere Schüler an.

Der Preis für die Nägel hängt vom Design ab:
Wenn Sie Natur klar wünschen, beträgt der Preis 15 €.
Wenn Sie Natur Make-up, French, Farbe, Glitzer, Ombre oder Katzenaugen möchten, kostet es 20 €.
Für aufwendigere Designs berechnen wir zusätzlich 1 € pro Design-Nagel, und jede Steinchen kostet 0,50 €.

Unsere Schüler können jedoch möglicherweise sehr komplizierte Muster nicht umsetzen.

Die Behandlungszeit beträgt in der Regel etwa 2 bis 3 Stunden, und das Ergebnis kann möglicherweise nicht perfekt sein — wir möchten Sie im Voraus darüber informieren, damit Sie Bescheid wissen.

Außerdem bieten wir eine Nachbesserung innerhalb von 3 Tagen an.

Ist das für Sie in Ordnung? 💅
{{END_TEMPLATE}}

⚠️ KRITISCH: Kopiere alles zwischen {{MODELLKUNDEN_TEMPLATE}} und {{END_TEMPLATE}}
⚠️ WORT FÜR WORT - keine Änderungen, keine Zusammenfassung
⚠️ Dies ist eine TEMPLATE-ANTWORT - verwende sie komplett

TEMPLATE 2: MODELLKUNDEN TERMIN-FRAGE
Nach Modell-Info wenn Kunde "OK" / "Ja" / "Passt" sagt:
→ "Perfekt! Welcher Tag passt Ihnen am besten, bitte?"

TEMPLATE 3: MODELLKUNDEN TERMIN-BESTÄTIGUNG
Wenn Modellkunde Tag/Zeit nennt:
→ "Vielen Dank! Bitte warten Sie kurz, unsere Mitarbeiter werden sich bei Ihnen melden, bitte."

TEMPLATE 4: NORMALE KUNDEN TERMIN-ANGEBOT
Wenn normaler Kunde nach Termin fragt:
→ "Gerne! Sie können online buchen: https://nailounge101.setmore.com/

Oder sagen Sie mir Ihren Wunschtermin (Tag und Uhrzeit), dann helfe ich Ihnen gerne, bitte!"

TEMPLATE 5: NORMALE KUNDEN TERMIN-BESTÄTIGUNG
Wenn normaler Kunde Tag/Zeit nennt:
→ "Perfekt! Bitte warten Sie kurz, unsere Mitarbeiter prüfen die Verfügbarkeit und erstellen Ihren Termin. Vielen Dank, bitte!"

WICHTIG - MODELLKUNDEN-ERKENNUNG:
- Keywords: modell, model, modellkunde, modellkundin, nagelmodell, modellnägel, als modell, übung, zum üben, training, schulung, azubi, 15euro, 15 euro
- Wenn Chat History EINES Keyword enthält → Verwende TEMPLATE 1 (komplett!)
- Einmal Modellkunde → bleibt Modellkunde für gesamte Konversation
- NIEMALS Setmore-Link an Modellkunden

BEISPIELE:

User: "Ich möchte als Modell kommen"
→ [Verwende TEMPLATE 1 komplett - alle Zeilen]

User: "Wie viel kostet für Azubi?"
→ [Verwende TEMPLATE 1 komplett - alle Zeilen]

User: [fragt nach Gel] "Und für 15 Euro?"
→ [Verwende TEMPLATE 1 komplett - alle Zeilen]

User: [nach Template 1] "OK"
→ [Verwende TEMPLATE 2]

User: [nach Template 2] "Donnerstag 14 Uhr"
→ [Verwende TEMPLATE 3]

PREISE (NORMALE KUNDEN):
Maniküre: ohne Lack 15€, mit Nagellack 25€, mit Shellac 35€
Neumodellage: Natur 30€, Farbe 35€, French 38€, Ombre 38€, Babyboomer 38€
Pediküre Basic: ohne 28€, Nagellack 35€, Shellac 45€, Gel 50€, Pulver 55€
Pediküre Advanced: ohne 33€, Nagellack 40€, Shellac 50€, Gel 55€, Pulver 60€
Pediküre Luxus: ohne 38€, Nagellack 45€, Shellac 55€, Gel 60€, Pulver 65€
Reparatur: Nagel 5€, Ablösen Shellac 10€, Ablösen Gel 15€
Massage: Hand 10€, Fuß 10€

REPARATUR:
- Bei uns gemacht: "Es tut uns sehr leid. Reparatur kostenlos innerhalb 30 Tagen, bitte."
- Nicht bei uns: "Reparatur 5 Euro pro Nagel, bitte."

WICHTIG:
- Template-Antworten verwenden wie geschrieben
- Template 1 (Modellkunden-Info) ist KOMPLETT - nicht zusammenfassen
- Beziehe dich auf Chat History
- Keine Wiederholungen von Begrüßungen
- Templates sind die Ausnahme zur "2-3 Sätze" Regel`;



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
  
  try {
    await pool.query(createTableQuery);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database init error:', error);
  }
}

// Get chat history (last 20 messages)
async function getChatHistory(contactId) {
  const query = `
    SELECT role, message, timestamp
    FROM chat_history
    WHERE contact_id = $1
    ORDER BY timestamp DESC
    LIMIT 20
  `;
  
  try {
    const result = await pool.query(query, [contactId]);
    // Reverse to get chronological order
    return result.rows.reverse();
  } catch (error) {
    console.error('❌ Get history error:', error);
    return [];
  }
}

// Save message to database
async function saveMessage(contactId, userName, role, message) {
  const query = `
    INSERT INTO chat_history (contact_id, user_name, role, message)
    VALUES ($1, $2, $3, $4)
  `;
  
  try {
    await pool.query(query, [contactId, userName, role, message]);
    console.log(`✅ Saved ${role} message`);
  } catch (error) {
    console.error('❌ Save message error:', error);
  }
}

// Format history for OpenAI
function formatHistory(history) {
  if (!history || history.length === 0) {
    return "No previous conversation.";
  }
  
  return history
    .map(msg => {
      // Escape quotes to prevent JSON issues
      const cleanMessage = msg.message.replace(/"/g, "'").replace(/\n/g, " ");
      return `[${msg.role}]: ${cleanMessage}`;
    })
    .join('\n');
}

// Main chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { contact_id, user_name, user_message } = req.body;
    
    // Validation
    if (!contact_id || !user_message) {
      return res.status(400).json({ 
        error: 'Missing contact_id or user_message' 
      });
    }
    
    console.log(`📩 New message from ${user_name} (${contact_id}): ${user_message}`);
    
    // 1. Get chat history
    const history = await getChatHistory(contact_id);
    const historyText = formatHistory(history);
    
    console.log(`📚 Found ${history.length} previous messages`);
    
    // 2. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Chat history (last 20 messages):\n${historyText}\n\n---\n\nNew message from customer: ${user_message}\n\n---\n\nBased on chat history, reply appropriately. If this is first message, greet warmly. If customer already mentioned something, refer back to it naturally.`
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    });
    
    const aiResponse = completion.choices[0].message.content;
    
    console.log(`🤖 AI response: ${aiResponse}`);
    
    // 3. Save messages to database
    await saveMessage(contact_id, user_name, 'user', user_message);
    await saveMessage(contact_id, user_name, 'assistant', aiResponse);
    
    // 4. Return response to ManyChat
    return res.json({
      success: true,
      ai_message: aiResponse
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      ai_message: 'Entschuldigung, es gab einen technischen Fehler. Bitte versuchen Sie es erneut.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint (optional - for debugging)
app.get('/history/:contactId', async (req, res) => {
  try {
    const history = await getChatHistory(req.params.contactId);
    res.json({ history });
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

