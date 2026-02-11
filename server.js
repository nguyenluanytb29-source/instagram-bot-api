// server.js - Instagram AI Bot API with Memory
// Tech stack: Node.js + Express + PostgreSQL + OpenAI

const express = require('express');
const { Pool } = require('pg');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

// Database connection with better error handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// System prompt
const SYSTEM_PROMPT = `Du bist der KI-Assistent von Nailounge101 Berlin (Reichsstraße 101, 14052 Berlin).

⚠️ WICHTIGSTE REGEL - KEINE WIEDERHOLUNGEN:
Wenn Chat History vorhanden → NIEMALS "Guten Tag", "Hallo", "Willkommen" sagen
Wenn Chat History LEER → Nur dann: "Guten Tag! Willkommen bei Nailounge101 Berlin. Wie kann ich helfen, bitte?"

GRUNDREGELN:
- Antworte auf Hochdeutsch, warm, professionell
- Maximal 2-3 Sätze (AUSSER Modellkunden-Info = sehr lang OK!)
- Mindestens 1× "bitte"
- Öffnungszeiten: Mo-Fr 09:30-19:00, Sa 09:30-16:00, So geschlossen

🔴🔴🔴 MODELLKUNDEN - VERWENDE GENAU DIESEN TEXT 🔴🔴🔴

KEYWORDS: modell, model, azubi, übung, training, schulung, 15euro, 15 euro

WENN User EINES Keyword erwähnt → Antworte MIT DIESEM GENAUEN TEXT (Zeile für Zeile):

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

⚠️ NICHT zusammenfassen! NICHT kürzen! Verwende ALLE Zeilen oben!
⚠️ Beginne mit "Guten Tag" und ende mit "Ist das für Sie in Ordnung? 💅"
⚠️ Dies ist die EINZIGE Ausnahme zur "2-3 Sätze" Regel

NACH MODELL-INFO:
- Kunde sagt "OK"/"Ja" → "Perfekt! Welcher Tag passt Ihnen am besten, bitte?"
- Kunde nennt Tag/Zeit → "Vielen Dank! Bitte warten Sie kurz, unsere Mitarbeiter werden sich bei Ihnen melden, bitte."

NORMALE KUNDEN (OHNE Modell-Keywords):
- Termin-Anfrage → "Gerne! Sie können online buchen: https://nailounge101.setmore.com/ Oder sagen Sie mir Ihren Wunschtermin, dann helfe ich gerne!"
- Tag/Zeit → "Perfekt! Bitte warten Sie kurz, unsere Mitarbeiter prüfen die Verfügbarkeit. Vielen Dank!"

PREISE (NORMALE KUNDEN):
Maniküre: ohne 15€, Nagellack 25€, Shellac 35€
Neumodellage: Natur 30€, Farbe 35€, French 38€, Ombre 38€
Pediküre: Basic ohne 28€, Advanced ohne 33€, Luxus ohne 38€
Reparatur: Nagel 5€, Ablösen 10-20€

WICHTIG:
- Modell-Keywords in GESAMTER Chat History checken
- Modellkunde bleibt Modellkunde
- NIEMALS Setmore-Link an Modellkunden
- Modell-Text ist lang (10+ Zeilen) - das ist OK!`;

// Full Modellkunde text - used when AI summarizes
const FULL_MODELL_TEXT = `Guten Tag

Wir freuen uns sehr, dass Sie sich für unsere Dienstleistungen interessieren.

Momentan nehmen wir noch Kunden für unsere Schüler an.

Der Preis für die Nägel hängt vom Design ab:
Wenn Sie Natur klar wünschen, beträgt der Preis 15 €.
Wenn Sie Natur Make-up, French, Farbe, Glitzer, Ombre oder Katzenaugen möchten, kostet es 20 €.
Für aufwendigere Designs berechnen wir zusätzlich 1 € pro Design-Nagel, und jede Steinchen kostet 0,50 €.

Unsere Schüler können jedoch möglicherweise sehr komplizierte Muster nicht umsetzen.

Die Behandlungszeit beträgt in der Regel etwa 2 bis 3 Stunden, und das Ergebnis kann möglicherweise nicht perfekt sein — wir möchten Sie im Voraus darüber informieren, damit Sie Bescheid wissen.

Außerdem bieten wir eine Nachbesserung innerhalb von 3 Tagen an.

Ist das für Sie in Ordnung? 💅`;

// Check if message contains Modellkunde keywords
function hasModellKeyword(text) {
  if (!text) return false;
  const keywords = ['modell', 'model', 'azubi', 'übung', 'training', 'schulung', '15euro', '15 euro', '15 €', '15€'];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

// Check if this conversation is about Modellkunde
function isModellkundeConversation(userMessage, history) {
  // Check current message
  if (hasModellKeyword(userMessage)) {
    return true;
  }
  
  // Check history
  if (history && history.length > 0) {
    for (const msg of history) {
      if (hasModellKeyword(msg.message)) {
        return true;
      }
    }
  }
  
  return false;
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
    console.error(`❌ Save ${role} message error:`, error.message);
    // Don't throw - continue even if save fails
  }
}

// Format history for OpenAI
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
    
    // 3. Get AI response
    let aiResponse = completion.choices[0].message.content;
    console.log(`🤖 AI response (original): ${aiResponse.substring(0, 100)}...`);
    
    // Check if this is Modellkunde conversation
    const isModellkunde = isModellkundeConversation(user_message, history);
    
    if (isModellkunde) {
      console.log('🔍 Detected Modellkunde conversation');
      
      // Check if AI gave short response (summarized)
      const isShortResponse = aiResponse.length < 400;
      const mentionsModell = aiResponse.includes('15') || aiResponse.includes('Natur') || aiResponse.includes('Modell');
      const notFullText = !aiResponse.includes('Wir freuen uns sehr');
      
      if (isShortResponse && mentionsModell && notFullText) {
        console.log(`⚠️ AI response too short (${aiResponse.length} chars) - using full Modell text`);
        aiResponse = FULL_MODELL_TEXT;
      } else if (aiResponse.includes('Wir freuen uns sehr')) {
        console.log('✅ AI sent full Modell text');
      } else {
        console.log('ℹ️ Modellkunde conversation but not asking for info yet');
      }
    }
    
    console.log(`🤖 AI response (final): ${aiResponse.substring(0, 100)}... (length: ${aiResponse.length})`);
    
    // 4. Send response FIRST (don't wait for save)
    res.json({
      bot_response: aiResponse
    });
    
    // 5. Save messages async (don't block response)
    saveMessage(contact_id, user_name, 'user', user_message).catch(err => {
      console.error('Failed to save user message:', err.message);
    });
    
    saveMessage(contact_id, user_name, 'assistant', aiResponse).catch(err => {
      console.error('Failed to save assistant message:', err.message);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      bot_response: 'Entschuldigung, es gab einen technischen Fehler. Bitte versuchen Sie es erneut.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint
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
