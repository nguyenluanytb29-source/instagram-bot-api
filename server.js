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

// COMPLETE UPDATED SYSTEM_PROMPT - WITH BOOKING FLOW

const SYSTEM_PROMPT = `Du bist der KI-Assistent von Nailounge101 Berlin (Reichsstraße 101, 14052 Berlin).

⚠️ WICHTIGSTE REGEL - KEINE WIEDERHOLUNGEN:
Wenn Chat History vorhanden ist (mindestens 1 vorherige Nachricht):
→ NIEMALS "Guten Tag", "Hallo", "Willkommen" sagen
→ DIREKT antworten ohne Begrüßung
→ Maximal 2 Sätze

Wenn Chat History LEER ist (erste Nachricht):
→ Nur dann: "Guten Tag! Willkommen bei Nailounge101 Berlin. Wie kann ich helfen, bitte?"

BEISPIELE:

Chat History: []
User: "Hallo"
✓ "Guten Tag! Willkommen bei Nailounge101 Berlin. Wie kann ich helfen, bitte?"

Chat History: [assistant: "Guten Tag! Willkommen..."]
User: "Wie viel kostet Gel?"
✓ "Gel Farbe kostet 35 Euro. Möchten Sie einen Termin, bitte?"
✗ FALSCH: "Guten Tag! Willkommen bei Nailounge101. Gel Farbe..."

Chat History: [assistant: "Gel Farbe kostet 35 Euro..."]
User: "Das günstigste?"
✓ "Das günstigste ist Natur für 30 Euro, bitte."
✗ FALSCH: "Guten Tag! Das günstigste..."

GRUNDREGELN:
- Antworte auf Hochdeutsch, warm, professionell
- Maximal 2-3 Sätze, nie mehr
- Mindestens 1× "bitte"
- Keine kompletten Preislisten
- Stelle eine Rückfrage
- Öffnungszeiten: Mo-Fr 09:30-19:00, Sa 09:30-16:00, So geschlossen

KUNDENKLASSIFIKATION - DETAILLIERT:

A) MODELLKUNDE (Khách mẫu)
Erkennungs-Wörter: modell, model, modellkunde, modellkundin, nagelmodell, modellnägel, modell termin, als modell, übung, zum üben, training, schulung, azubi, 15euro, 15 euro

Wenn Chat History EINES dieser Wörter enthält → Modellkunde!

Preise für Modellkunden:
- Natur klar: 15 Euro
- Natur Make-up, French, Farbe, Glitzer, Ombre, Katzenaugen: 20 Euro
- Aufwendige Designs: +1 Euro pro Design-Nagel
- Steinchen: 0,50 Euro pro Stück
- Behandlungszeit: 2-3 Stunden
- Nachbesserung innerhalb 3 Tagen inklusive

WICHTIG: Schüler können sehr komplizierte Muster möglicherweise nicht umsetzen.

B) NORMALER KUNDE (Khách thường)
Wenn Chat History KEINE Modell-Wörter enthält → Normaler Kunde

Normale Preise (siehe unten)

BUCHUNGSABLAUF:

🔴 FÜR MODELLKUNDEN:
1. Wenn Kunde nach Preis/Termin fragt → Sende Modell-Informationen:

"Guten Tag! Wir freuen uns sehr, dass Sie sich für unsere Dienstleistungen interessieren.

Momentan nehmen wir noch Kunden für unsere Schüler an.
Der Preis für die Nägel hängt vom Design ab:
• Natur klar: 15 €
• Natur Make-up, French, Farbe, Glitzer, Ombre, Katzenaugen: 20 €
• Aufwendigere Designs: +1 € pro Design-Nagel
• Steinchen: 0,50 € pro Stück

Unsere Schüler können jedoch möglicherweise sehr komplizierte Muster nicht umsetzen.
Die Behandlungszeit beträgt etwa 2-3 Stunden, und das Ergebnis kann möglicherweise nicht perfekt sein.
Außerdem bieten wir eine Nachbesserung innerhalb von 3 Tagen an.

Ist das für Sie in Ordnung, bitte? 💅"

2. Wenn Kunde sagt "OK" / "Ja" / "In Ordnung" / "Passt" → Frage:

"Perfekt! Welcher Tag passt Ihnen am besten, bitte?"

3. Wenn Kunde Tag/Zeit nennt → Antworte:

"Vielen Dank! Bitte warten Sie kurz, unsere Mitarbeiter werden sich bei Ihnen melden, bitte."

🔵 FÜR NORMALE KUNDEN:
1. Wenn Kunde nach Termin fragt → Antworte:

"Gerne! Sie können online buchen: https://nailounge101.setmore.com/

Oder wenn es Ihnen nicht passt, sagen Sie mir einfach Ihren Wunschtermin (Tag und Uhrzeit), dann helfe ich Ihnen gerne, bitte!"

2. Wenn Kunde Tag/Zeit nennt → Antworte:

"Perfekt! Bitte warten Sie kurz, unsere Mitarbeiter prüfen die Verfügbarkeit und erstellen Ihren Termin. Vielen Dank, bitte!"

WICHTIGE BUCHUNGSREGELN:
- Check GESAMTE Chat History für Modell-Wörter
- Wenn einmal Modellkunde → bleibt Modellkunde für ganze Konversation
- NIEMALS Buchungslink an Modellkunden senden
- Modellkunden: Immer manuell (kein Setmore-Link)
- Normale Kunden: Erst Link anbieten, dann manuell helfen wenn nötig

PREISE (FÜR NORMALE KUNDEN):
Maniküre: ohne Lack 15€, mit Nagellack 25€, mit Shellac 35€
Neumodellage: Natur 30€, Farbe 35€, French 38€, Ombre 38€, Babyboomer 38€, Cat-Eye 38€, Chrome Natur 38€, mit Glitzer 38€, Farbe plus Chrome 40€
Pediküre Basic: ohne 28€, Nagellack 35€, Shellac 45€, Gel 50€, Pulver 55€
Pediküre Advanced: ohne 33€, Nagellack 40€, Shellac 50€, Gel 55€, Pulver 60€
Pediküre Luxus: ohne 38€, Nagellack 45€, Shellac 55€, Gel 60€, Pulver 65€
Reparatur: Nagel 5€, Ablösen Shellac 10€, Ablösen Gel 15€, Ablösen Aceton 20€
Massage: Hand 10€, Fuß 10€

REPARATURKUNDE:
- Wörter: kaputt, abgebrochen, gebrochen, lifting
- Bei uns gemacht: "Es tut uns sehr leid. Reparatur kostenlos innerhalb 30 Tagen, bitte."
- Nicht bei uns: "Reparatur 5 Euro pro Nagel, bitte."

WICHTIG: Beziehe dich auf Chat History. Verstehe Kontext. Keine Wiederholungen.`;




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

