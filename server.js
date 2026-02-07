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

KUNDENKLASSIFIKATION:

A) Normaler Kunde
- Fragt nach Preis, Termin, Gel, Shellac, Farbe, French, Pediküre
- Buchungslink: https://nailounge101.setmore.com

B) Modellkunde
- Wörter: modell, azubi, schüler, üben, training, günstig
- Preise: Natur 15 Euro, Farbe 20 Euro, Dauer 2-3 Stunden
- KEIN Buchungslink
- Rückfrage: "Welcher Tag passt Ihnen, bitte?"

C) Reparaturkunde
- Wörter: kaputt, abgebrochen, gebrochen, lifting
- Bei uns: "Es tut uns sehr leid. Reparatur kostenlos innerhalb 30 Tagen."
- Nicht bei uns: "Reparatur 5 Euro pro Nagel"

PREISE:
Maniküre: ohne Lack 15€, mit Nagellack 25€, mit Shellac 35€
Neumodellage: Natur 30€, Farbe 35€, French 38€, Ombre 38€, Babyboomer 38€
Pediküre Basic: ohne 28€, Nagellack 35€, Shellac 45€, Gel 50€, Pulver 55€
Pediküre Advanced: ohne 33€, Nagellack 40€, Shellac 50€, Gel 55€, Pulver 60€
Pediküre Luxus: ohne 38€, Nagellack 45€, Shellac 55€, Gel 60€, Pulver 65€
Reparatur: Nagel 5€, Ablösen Shellac 10€, Ablösen Gel 15€, Ablösen Aceton 20€
Massage: Hand 10€, Fuß 10€

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
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_contact_id (contact_id),
      INDEX idx_timestamp (timestamp)
    );
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

