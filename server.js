// ═══════════════════════════════════════════════════════════════
// NAILOUNGE101 CHATBOT - OPTIMIZED VERSION
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const { OpenAI } = require('openai');

const app = express();
app.use(bodyParser.json());

// ═══════════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ═══════════════════════════════════════════════════════════════

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ═══════════════════════════════════════════════════════════════
// OPENAI CONNECTION
// ═══════════════════════════════════════════════════════════════

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ═══════════════════════════════════════════════════════════════
// MESSAGE CONSTANTS (KEEP FROM OLD FILE)
// ═══════════════════════════════════════════════════════════════

const MODELL_MESSAGE = `Guten Tag! 😊

Unser **Modellkunde-Service**:

💅 **Was ist das?**
Du lässt dich von unseren talentierten Auszubildenden verwöhnen - perfekt, um neue Looks auszuprobieren!

⏰ **Dauer:** 2-3 Stunden (etwas länger als normal)
💰 **Preis:** 15€-20€ (günstiger als regulärer Service)

📅 **Termin buchen:**
https://nailounge101.setmore.com/

Wir freuen uns auf dich! 💖`;

const MODELL_MESSAGE_EN = `Hello! 😊

Our **Model Customer Service**:

💅 **What is it?**
You'll be pampered by our talented trainees - perfect for trying new looks!

⏰ **Duration:** 2-3 hours (a bit longer than normal)
💰 **Price:** 15€-20€ (cheaper than regular service)

📅 **Book appointment:**
https://nailounge101.setmore.com/

We look forward to seeing you! 💖`;

const MODELL_MESSAGE_VI = `Xin chào! 😊

**Dịch vụ Khách Mẫu**:

💅 **Đây là gì?**
Bạn sẽ được các học viên tài năng phục vụ - hoàn hảo để thử những style mới!

⏰ **Thời gian:** 2-3 giờ (lâu hơn dịch vụ thường một chút)
💰 **Giá:** 15€-20€ (rẻ hơn dịch vụ thường)

📅 **Đặt lịch:**
https://nailounge101.setmore.com/

Rất mong được phục vụ bạn! 💖`;

// ═══════════════════════════════════════════════════════════════
// DATABASE HELPER FUNCTIONS (FROM OLD FILE)
// ═══════════════════════════════════════════════════════════════

async function getChatHistory(contactId) {
  try {
    const result = await pool.query(
      'SELECT role, message, timestamp FROM chat_history WHERE contact_id = $1 ORDER BY timestamp ASC',
      [contactId]
    );
    return result.rows;
  } catch (error) {
    console.error('❌ Get chat history error:', error.message);
    return [];
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

async function updateConversationSummary(contactId, userName, history) {
  try {
    const historyText = formatHistory(history);
    
    const existingSummary = await pool.query(
      'SELECT summary FROM conversation_summary WHERE contact_id = $1',
      [contactId]
    );
    
    const existingSummaryText = existingSummary.rows.length > 0
      ? `Bisherige Zusammenfassung:\n${existingSummary.rows[0].summary}\n\n`
      : '';
    
    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Assistent, der Kundengespräche für einen Nagelstudio-Bot zusammenfasst.
Erstelle eine kompakte Zusammenfassung auf Deutsch, die folgende Infos enthält (wenn vorhanden):
- Was der Kunde gefragt/gewünscht hat
- Welche Dienstleistungen besprochen wurden
- Ob ein Termin vereinbart wurde (Tag, Uhrzeit IN 24H-FORMAT: 14:00, 18:00 etc.)
- Ob der Kunde ein Modellkunde ist
- Besondere Wünsche oder Präferenzen
- Aktueller Status (z.B. "wartet auf Bestätigung", "Termin gebucht", "fragt nach Preis")
WICHTIG: Speichere Uhrzeiten IMMER in 24h-Format und ändere sie NIEMALS!
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

// ═══════════════════════════════════════════════════════════════
// NEW: LANGUAGE DETECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getSavedLanguage(contactId) {
  try {
    const result = await pool.query(
      'SELECT preferred_language FROM conversation_summary WHERE contact_id = $1',
      [contactId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].preferred_language;
  } catch (error) {
    console.error('Error getSavedLanguage:', error);
    return null;
  }
}

async function updateLanguage(contactId, language) {
  try {
    await pool.query(`
      UPDATE conversation_summary
      SET preferred_language = $1,
          last_updated = NOW()
      WHERE contact_id = $2
    `, [language, contactId]);
    
    console.log(`✅ Language updated: ${language}`);
  } catch (error) {
    console.error('Error updateLanguage:', error);
  }
}

async function ensureCustomerRecord(contactId, userName) {
  try {
    await pool.query(`
      INSERT INTO conversation_summary (contact_id, user_name, preferred_language, customer_type_flag, created_at, last_updated)
      VALUES ($1, $2, 'de', 'NORMAL', NOW(), NOW())
      ON CONFLICT (contact_id) DO NOTHING
    `, [contactId, userName]);
  } catch (error) {
    console.error('Error ensureCustomerRecord:', error);
  }
}

function detectGreeting(message) {
  const greetings = {
    vi: ['xin chào', 'chào'],
    de: ['guten tag', 'hallo', 'guten morgen', 'guten abend'],
    en: ['hello', 'hi', 'hey', 'good morning', 'good afternoon']
  };
  
  const lower = message.toLowerCase().trim();
  
  for (const [lang, patterns] of Object.entries(greetings)) {
    for (const greeting of patterns) {
      if (lower === greeting || 
          lower.startsWith(greeting + ' ') || 
          lower.startsWith(greeting + ',')) {
        return { isGreeting: true, language: lang };
      }
    }
  }
  
  return { isGreeting: false };
}

function fastLanguageDetection(message) {
  const lower = message.toLowerCase().trim();
  
  // Vietnamese unique characters
  const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;
  if (vietnameseChars.test(message)) {
    return 'vi';
  }
  
  // German structure scoring
  const germanIndicators = {
    articles: ['der', 'die', 'das', 'eine', 'ein', 'einem', 'einer', 'den', 'dem', 'des'],
    modalVerbs: ['würde', 'möchte', 'könnte', 'sollte', 'hätte', 'kann', 'muss', 'will'],
    commonWords: ['gerne', 'auch', 'person', 'personen', 'bitte', 'danke', 'sehr']
  };
  
  let germanScore = 0;
  
  germanIndicators.articles.forEach(word => {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      germanScore += 2;
    }
  });
  
  germanIndicators.modalVerbs.forEach(word => {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      germanScore += 3;
    }
  });
  
  germanIndicators.commonWords.forEach(word => {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      germanScore += 1;
    }
  });
  
  if (germanScore >= 4) {
    return 'de';
  }
  
  return null;
}

async function aiLanguageDetection(message) {
  try {
    const prompt = `Detect the PRIMARY language of this message.

Analyze sentence structure, grammar patterns, word order.
Ignore borrowed words (e.g., "model" appears in all languages).

Message: "${message}"

Respond with ONLY ONE word: "german", "english", or "vietnamese"`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 10,
      temperature: 0.1
    });
    
    const detected = response.choices[0].message.content.trim().toLowerCase();
    
    if (detected === 'german') return 'de';
    if (detected === 'vietnamese') return 'vi';
    return 'en';
  } catch (error) {
    console.error('Error aiLanguageDetection:', error);
    return 'de'; // Default to German
  }
}

async function detectLanguage(message, contactId) {
  console.log('\n🌍 === LANGUAGE DETECTION ===');
  
  // Check for greeting
  const greetingCheck = detectGreeting(message);
  if (greetingCheck.isGreeting) {
    console.log(`✅ Greeting: ${greetingCheck.language}`);
    return {
      language: greetingCheck.language,
      shouldReset: true
    };
  }
  
  // Get saved language
  const savedLang = await getSavedLanguage(contactId);
  
  // New customer - default German
  if (!savedLang) {
    console.log('🆕 New customer - default: German');
    
    const fastResult = fastLanguageDetection(message);
    const detectedLang = fastResult || await aiLanguageDetection(message);
    
    if (detectedLang !== 'de') {
      console.log(`🔄 Detected ${detectedLang}, updating from default`);
      await updateLanguage(contactId, detectedLang);
      return { language: detectedLang, shouldReset: false };
    }
    
    return { language: 'de', shouldReset: false };
  }
  
  // Returning customer - detect if switched
  const fastResult = fastLanguageDetection(message);
  const detectedLang = fastResult || await aiLanguageDetection(message);
  
  if (detectedLang !== savedLang) {
    console.log(`🔄 Language switch: ${savedLang} → ${detectedLang}`);
    await updateLanguage(contactId, detectedLang);
  }
  
  return { language: detectedLang, shouldReset: false };
}

// ═══════════════════════════════════════════════════════════════
// NEW: CUSTOMER CLASSIFICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getCurrentCustomerFlag(contactId) {
  try {
    const result = await pool.query(
      'SELECT customer_type_flag FROM conversation_summary WHERE contact_id = $1',
      [contactId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].customer_type_flag || 'NORMAL';
  } catch (error) {
    console.error('Error getCurrentCustomerFlag:', error);
    return null;
  }
}

async function updateCustomerFlag(contactId, customerType) {
  try {
    await pool.query(`
      UPDATE conversation_summary
      SET customer_type_flag = $1,
          last_updated = NOW()
      WHERE contact_id = $2
    `, [customerType, contactId]);
    
    console.log(`✅ Customer flag updated: ${customerType}`);
  } catch (error) {
    console.error('Error updateCustomerFlag:', error);
  }
}

async function aiClassifyCustomer(message, history, language) {
  try {
    const conversationHistory = history
      .slice(-10)
      .map(msg => `[${msg.role}]: ${msg.message}`)
      .join('\n');
    
    const prompt = `You are an expert customer classifier for Nailounge101 nail salon.

═══════════════════════════════════════════════════════════════
🚨 CRITICAL: DISAMBIGUATE "MẪU" / "MODEL" / "MODELL"
═══════════════════════════════════════════════════════════════

The word has TWO COMPLETELY DIFFERENT MEANINGS:

1️⃣ MODEL CUSTOMER SERVICE (Khách mẫu):
   → Customer for student practice
   → Price: 15€-20€ (cheaper)
   → Duration: 2-3 hours
   
   EXAMPLES:
   ✅ "Giá khách mẫu bao nhiêu?" → MODEL SERVICE PRICE
   ✅ "Tôi muốn làm khách mẫu" → WANTS MODEL SERVICE
   ✅ "How much is model service?" → MODEL SERVICE
   ✅ "Was kostet Modellkunde?" → MODEL SERVICE
   ✅ "Giá mẫu?" [in service context] → MODEL SERVICE
   ✅ "Azubi" / "Auszubildende" → MODEL SERVICE

2️⃣ NAIL DESIGN (Mẫu nail):
   → Design patterns, styles
   
   EXAMPLES:
   ❌ "Có mẫu mới không?" → NEW NAIL DESIGNS
   ❌ "Mẫu đẹp quá!" → NAIL DESIGN
   ❌ "Cho tôi xem mẫu" → NAIL DESIGNS
   ❌ "New designs please" → NAIL DESIGNS

3️⃣ SWITCHING FROM MODEL TO REGULAR SERVICE:
   → Customer explicitly wants regular professional service
   
   EXAMPLES:
   🔄 "Tôi muốn đổi sang dịch vụ thường" → SWITCH TO NORMAL
   🔄 "Không muốn làm khách mẫu nữa" → SWITCH TO NORMAL
   🔄 "I want regular service instead" → SWITCH TO NORMAL
   🔄 "Ich möchte normale Dienstleistung" → SWITCH TO NORMAL

═══════════════════════════════════════════════════════════════
CLASSIFICATION RULES
═══════════════════════════════════════════════════════════════

→ MODELL: Customer ASKS ABOUT or WANTS model service
→ NORMAL with contextType "switch_to_normal": Customer explicitly wants to switch FROM model TO regular service
→ NORMAL: Everything else

═══════════════════════════════════════════════════════════════
CONVERSATION HISTORY
═══════════════════════════════════════════════════════════════
${conversationHistory || '[No history]'}

═══════════════════════════════════════════════════════════════
CURRENT MESSAGE (${language})
═══════════════════════════════════════════════════════════════
"${message}"

═══════════════════════════════════════════════════════════════
RESPONSE (JSON only)
═══════════════════════════════════════════════════════════════

{
  "classification": "MODELL" or "NORMAL",
  "confidence": 0-100,
  "reasoning": "Detailed explanation",
  "contextType": "model_customer" or "nail_design" or "switch_to_normal" or "other"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error aiClassifyCustomer:', error);
    return {
      classification: 'NORMAL',
      confidence: 0,
      reasoning: 'Error - defaulting to NORMAL',
      contextType: 'error'
    };
  }
}

async function classifyCustomer(message, contactId, history, language) {
  console.log('\n🎯 === CUSTOMER CLASSIFICATION ===');
  
  const currentFlag = await getCurrentCustomerFlag(contactId);
  console.log(`📖 Current flag: ${currentFlag || 'NONE'}`);
  
  // Classify with AI (always check for type switching)
  console.log('🤖 Calling AI classification...');
  const aiResult = await aiClassifyCustomer(message, history, language);
  
  console.log(`AI: ${aiResult.classification} (${aiResult.confidence}%)`);
  console.log(`Context: ${aiResult.contextType}`);
  
  // Validation
  const CONFIDENCE_THRESHOLD = 75;
  
  // If already MODELL, stay MODELL unless customer explicitly wants NORMAL
  if (currentFlag === 'MODELL') {
    // Check if customer wants to switch to NORMAL service
    if (aiResult.classification === 'NORMAL' && 
        aiResult.confidence >= CONFIDENCE_THRESHOLD &&
        aiResult.contextType === 'switch_to_normal') {
      console.log('🔄 Customer requests switch: MODELL → NORMAL');
      await updateCustomerFlag(contactId, 'NORMAL');
      return 'NORMAL';
    }
    
    console.log('✅ Keep flag: MODELL (persistent)');
    return 'MODELL';
  }
  
  // If currently NORMAL, check if should upgrade to MODELL
  if (aiResult.confidence < CONFIDENCE_THRESHOLD) {
    console.log(`⚠️ Low confidence - keeping NORMAL`);
    return 'NORMAL';
  }
  
  if (aiResult.contextType === 'nail_design') {
    console.log('✅ Nail design context → NORMAL');
    return 'NORMAL';
  }
  
  if (aiResult.classification === 'MODELL' && aiResult.confidence >= CONFIDENCE_THRESHOLD) {
    console.log('✅ Updating flag: NORMAL → MODELL (permanent)');
    await updateCustomerFlag(contactId, 'MODELL');
    return 'MODELL';
  }
  
  console.log('✅ Classification: NORMAL');
  return 'NORMAL';
}

// ═══════════════════════════════════════════════════════════════
// RESPONSE GENERATION
// ═══════════════════════════════════════════════════════════════

async function generateAIResponse(message, history, language, customerType) {
  console.log('\n🤖 === GENERATING AI RESPONSE ===');
  
  const historyText = formatHistory(history);
  
  const serviceInfo = customerType === 'MODELL' 
    ? 'Model Service: 15-20€, 2-3h, student practice'
    : 'Professional service: Standard prices, quality guaranteed';
  
  const langNames = { de: 'German', en: 'English', vi: 'Vietnamese' };
  const langName = langNames[language] || 'German';
  
  const systemPrompt = `You are Nailounge101 AI assistant for a nail salon in Berlin.

CRITICAL RULES:
1. LANGUAGE: Respond in ${langName}
2. CONCISE: 2-4 sentences max (mobile users)
3. NATURAL: Friendly but professional
4. HELPFUL: Answer directly

SALON INFO:
${serviceInfo}
Hours: Mon-Sat 10:00-18:00 | Sun: CLOSED
Booking: https://nailounge101.setmore.com/

CONVERSATION HISTORY:
${historyText}

CUSTOMER MESSAGE:
"${message}"

Response (2-4 sentences, ${langName}):`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.2,
      max_tokens: 400
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating response:', error);
    
    // Fallback
    const fallbacks = {
      de: 'Entschuldigung, ich hatte ein technisches Problem. Wie kann ich Ihnen helfen?',
      en: 'Sorry, I had a technical issue. How can I help you?',
      vi: 'Xin lỗi, tôi gặp sự cố kỹ thuật. Tôi có thể giúp gì cho bạn?'
    };
    
    return fallbacks[language] || fallbacks.de;
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN WEBHOOK ENDPOINT
// ═══════════════════════════════════════════════════════════════

app.post('/webhook', async (req, res) => {
  try {
    const { contact_id, user_name, user_message } = req.body;
    
    if (!contact_id || !user_message) {
      return res.status(400).json({ 
        error: 'Missing contact_id or user_message' 
      });
    }
    
    console.log('\n\n🚀 ========== NEW MESSAGE ==========');
    console.log(`Contact: ${contact_id} (${user_name})`);
    console.log(`Message: "${user_message}"`);
    console.log('====================================\n');
    
    // Ensure customer record exists
    await ensureCustomerRecord(contact_id, user_name);
    
    // Get conversation history
    const history = await getChatHistory(contact_id);
    
    // LAYER 1: Language Detection
    const langResult = await detectLanguage(user_message, contact_id);
    const userLang = langResult.language;
    
    console.log(`\n📌 Language: ${userLang}`);
    
    // NOTE: Greeting detection updates language but does NOT reset customer type
    // Customer type (MODELL/NORMAL) persists across conversations
    
    // LAYER 2: Customer Classification
    const customerType = await classifyCustomer(user_message, contact_id, history, userLang);
    
    console.log(`\n📌 Customer Type: ${customerType}`);
    
    // LAYER 3: Generate Response
    let botResponse;
    
    if (customerType === 'MODELL') {
      // Check if first time asking about model service
      const hasModellInfo = history.some(msg => 
        msg.role === 'assistant' && 
        (msg.message.includes('Modellkunde') || 
         msg.message.includes('Model Customer') ||
         msg.message.includes('Khách Mẫu'))
      );
      
      if (!hasModellInfo && history.length < 3) {
        // First time - send standard model message
        const alreadyGreeted = history.some(msg => msg.role === 'assistant');
        
        let modellMessage;
        if (userLang === 'vi') {
          modellMessage = MODELL_MESSAGE_VI;
          if (alreadyGreeted) {
            modellMessage = modellMessage.replace('Xin chào! 😊\n\n', '');
          }
        } else if (userLang === 'en') {
          modellMessage = MODELL_MESSAGE_EN;
          if (alreadyGreeted) {
            modellMessage = modellMessage.replace('Hello! 😊\n\n', '');
          }
        } else {
          modellMessage = MODELL_MESSAGE;
          if (alreadyGreeted) {
            modellMessage = modellMessage.replace('Guten Tag! 😊\n\n', '');
          }
        }
        
        botResponse = modellMessage;
        console.log('📤 Sending standard MODELL message');
      } else {
        // Follow-up question - use AI
        botResponse = await generateAIResponse(user_message, history, userLang, 'MODELL');
      }
    } else {
      // Normal customer - use AI
      botResponse = await generateAIResponse(user_message, history, userLang, 'NORMAL');
    }
    
    // Save messages
    await saveMessage(contact_id, user_name, 'user', user_message);
    await saveMessage(contact_id, user_name, 'assistant', botResponse);
    
    // Update summary
    const updatedHistory = await getChatHistory(contact_id);
    updateConversationSummary(contact_id, user_name, updatedHistory).catch(err => {
      console.error('Failed to update summary:', err.message);
    });
    
    // Return response in OLD FORMAT
    console.log('\n✅ ========== FINAL RESPONSE ==========');
    console.log(`Language: ${userLang}`);
    console.log(`Type: ${customerType}`);
    console.log(`Response: "${botResponse.substring(0, 100)}..."`);
    console.log('======================================\n');
    
    res.json({
      bot_response: botResponse,
      bot_response_2: "EMPTY_RESPONSE",
      bot_response_3: "EMPTY_RESPONSE"
    });
    
  } catch (error) {
    console.error('❌ ERROR in webhook:', error);
    
    res.status(500).json({
      bot_response: "Entschuldigung, es gab einen technischen Fehler. Bitte versuchen Sie es erneut.",
      bot_response_2: "EMPTY_RESPONSE",
      bot_response_3: "EMPTY_RESPONSE"
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0-optimized'
  });
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 NAILOUNGE101 CHATBOT - OPTIMIZED VERSION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Language: Default German, auto-detect`);
  console.log(`✅ Classification: Pure AI with "mẫu" disambiguation`);
  console.log(`✅ Quality: Multi-layer validation`);
  console.log('═══════════════════════════════════════════════════════════');
});
