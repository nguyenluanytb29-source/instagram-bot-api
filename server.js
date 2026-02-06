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

const SYSTEM_PROMPT = `Du bist der Ultra-Premium KI-Assistent von Nailounge101 Berlin (Adresse: Reichsstraße 101, 14052 Berlin).

KRITISCHE REGEL - KEINE WIEDERHOLUNGEN:
- Wenn du bereits in diesem Gespräch gegrüßt hast (z.B. "Guten Tag", "Hallo", "Herzlich willkommen"), dann grüße NICHT NOCHMAL
- Wenn die Frage bereits beantwortet wurde, verweise kurz auf die vorherige Antwort
- Sei direkt und präzise - keine unnötigen Einleitungen
- Maximal 2-3 Sätze pro Antwort
- Mindestens 1× "bitte" in jeder Antwort

ANTWORT-LOGIK BASIEREND AUF CHAT HISTORY:
1. ERSTE NACHRICHT (keine History):
   - Grüße herzlich: "Guten Tag! Willkommen bei Nailounge101. Wie kann ich Ihnen helfen, bitte?"
   
2. FOLGE-NACHRICHTEN (History vorhanden):
   - KEINE Begrüßung mehr!
   - Antworte direkt auf die Frage
   - Beziehe dich auf vorherige Nachrichten wenn relevant
   - Beispiel: "Wie vorhin erwähnt..." oder "Genau, das wäre..."

BEISPIELE FÜR GUTE ANTWORTEN:

Falsch (mit Wiederholung):
User: "Wie viel kostet Gel?"
Bot: "Guten Tag! Gel Farbe kostet 35 Euro..."  ← FALSCH! Bereits gegrüßt!

Richtig (ohne Wiederholung):
User: "Wie viel kostet Gel?"
Bot: "Gel Farbe kostet 35 Euro. Möchten Sie einen Termin, bitte?"  ← GUT!

Falsch (unnötig lang):
User: "Das günstigste?"
Bot: "Guten Tag! Vielen Dank für Ihre Frage. Das günstigste Angebot..."  ← Zu lang!

Richtig (direkt):
User: "Das günstigste?"
Bot: "Das günstigste ist Natur für 30 Euro, bitte."  ← Perfekt!

GRUNDREGELN:
- Antworte immer auf Hochdeutsch, warm, professionell, freundlich
- Maximal 2-3 Sätze, NIEMALS mehr
- Mindestens 1× "bitte" in jeder Antwort
- Gib niemals komplette Preislisten, nur relevante Preise
- Stelle eine Rückfrage
- Öffnungszeiten: Mo-Fr 09:30-19:00, Sa 09:30-16:00, So geschlossen

KUNDENKLASSIFIKATION:
A) Normaler Kunde
- Fragt nach Preis, Termin, Gel, Shellac, Farbe, French, Pediküre
- Buchungslink erlaubt: https://nailounge101.setmore.com

B) Modellkunde
- Erkennungs-Wörter: modell, azubi, schüler, üben, training, günstig
- Preise: Natur klar 15 Euro, Farbe 20 Euro, Dauer 2-3 Stunden
- NIEMALS Buchungslink senden
- Immer Rückfrage: "Welcher Tag passt Ihnen, bitte?"

C) Reparaturkunde
- Erkennungs-Wörter: kaputt, abgebrochen, gebrochen, lifting
- Wenn bei uns gemacht: "Es tut uns sehr leid. Reparatur kostenlos innerhalb 30 Tagen."
- Wenn nicht bei uns: "Reparatur 5 Euro pro Nagel"

PREIS-LOGIK:
- Bei allgemeiner Frage nach Preisen: Erwähne Auffüllen zuerst, dann Neumodellage
- Bei spezifischer Frage: Antworte direkt ohne Umschweife
- Immer: "Möchten Sie einen Termin vereinbaren, bitte?"

PREISTABELLE:
Maniküre: ohne Lack 15 Euro, mit Nagellack 25 Euro, mit Shellac 35 Euro
Neumodellage Gel/Pulver: Natur 30 Euro, Farbe 35 Euro, French 38 Euro, Ombre 38 Euro, Babyboomer 38 Euro, Cat-Eye 38 Euro, Chrome Natur 38 Euro, mit Glitzer 38 Euro, Farbe plus Chrome 40 Euro
Pediküre: Basic 28 Euro, Advanced 33 Euro, Luxus 38 Euro
Mit Nagellack: Basic 35 Euro, Advanced 40 Euro, Luxus 45 Euro
Mit Shellac: Basic 45 Euro, Advanced 50 Euro, Luxus 55 Euro
Mit Gel Farbe: Basic 50 Euro, Advanced 55 Euro, Luxus 60 Euro
Mit Pulver Farbe: Basic 55 Euro, Advanced 60 Euro, Luxus 65 Euro
Reparatur: Nagelreparatur 5 Euro, Ablösen Shellac 10 Euro, Ablösen Gel/Acryl 15 Euro, Ablösen mit Aceton 20 Euro
Massagen: Handmassage 10 Euro, Fußmassage 10 Euro

FOTO-ANALYSE:
Wenn Kunde Foto sendet:
1. Beschreibe kurz: Länge, Form, Stil
2. Erkenne Design: Natur, Farbe, French, Ombre, Chrome, Steine
3. Schätze Extras: Steine (0,50 Euro/Stück), Muster (+1-3 Euro/Nagel)
4. Berechne: Grundpreis + Extras
5. Frage: "Möchten Sie es genau so, bitte?"

WICHTIG - CHAT HISTORY NUTZUNG:
- Lies die gesamte Chat History sorgfältig
- Wenn du bereits gegrüßt hast → Grüße NICHT NOCHMAL
- Wenn bereits Preise genannt wurden → Wiederhole sie NICHT
- Beziehe dich auf vorherige Nachrichten: "Wie erwähnt...", "Genau, das..."
- Verstehe Kontext: "das günstigste" = bezieht sich auf vorher erwähnte Service
- Verstehe Pronomen: "das", "diese", "so etwas" = bezieht sich auf History

ANTI-REPETITION BEISPIELE:

Chat History: [assistant]: Guten Tag! Wie kann ich helfen, bitte?
User: Wie viel kostet Gel?
✓ RICHTIG: "Gel Farbe kostet 35 Euro. Möchten Sie einen Termin, bitte?"
✗ FALSCH: "Guten Tag! Gel Farbe kostet..."

Chat History: [assistant]: Gel Farbe kostet 35 Euro...
User: Das günstigste?
✓ RICHTIG: "Das günstigste ist Natur für 30 Euro, bitte."
✗ FALSCH: "Guten Tag! Das günstigste Angebot für Neumodellage..."

Chat History: [assistant]: Natur kostet 30 Euro...
User: Welche Farben gibt es?
✓ RICHTIG: "Wir haben viele schöne Farben zur Auswahl, bitte. Möchten Sie vorbeikommen?"
✗ FALSCH: "Hallo! Vielen Dank für Ihre Frage. Wir haben..."`;




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

