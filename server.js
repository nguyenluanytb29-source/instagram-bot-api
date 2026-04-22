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
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const MODELL_MESSAGE = {
  de: `Unser Modellkunde-Service:

💅 **Was ist das?**
Du lässt dich von unseren talentierten Auszubildenden verwöhnen - perfekt, um neue Looks auszuprobieren!

⏰ **Dauer:** 2-3 Stunden (etwas länger als normal)
💰 **Preis:** 15€-20€ (günstiger als regulärer Service)

📅 **Termin buchen:**
https://nailounge101.setmore.com/

Wir freuen uns auf dich! 💖`,
  
  en: `Our Model Customer Service:

💅 **What is it?**
You'll be pampered by our talented trainees - perfect for trying new looks!

⏰ **Duration:** 2-3 hours (a bit longer than normal)
💰 **Price:** 15€-20€ (cheaper than regular service)

📅 **Book appointment:**
https://nailounge101.setmore.com/

We look forward to seeing you! 💖`,
  
  vi: `Dịch vụ Khách Mẫu:

💅 **Đây là gì?**
Bạn sẽ được các học viên tài năng phục vụ - hoàn hảo để thử những style mới!

⏰ **Thời gian:** 2-3 giờ (lâu hơn dịch vụ thường một chút)
💰 **Giá:** 15€-20€ (rẻ hơn dịch vụ thường)

📅 **Đặt lịch:**
https://nailounge101.setmore.com/

Rất mong được phục vụ bạn! 💖`
};

// ═══════════════════════════════════════════════════════════════
// DATABASE HELPER FUNCTIONS
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

async function createNewCustomer(contactId) {
  try {
    await pool.query(`
      INSERT INTO conversation_summary (contact_id, preferred_language, customer_type_flag, created_at, last_updated)
      VALUES ($1, 'de', 'NORMAL', NOW(), NOW())
      ON CONFLICT (contact_id) DO NOTHING
    `, [contactId]);
    
    console.log('✅ New customer created: language=de, type=NORMAL');
  } catch (error) {
    console.error('Error createNewCustomer:', error);
  }
}

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

async function getConversationHistory(contactId, limit = 10) {
  try {
    const result = await pool.query(`
      SELECT role, message, timestamp
      FROM conversation_history
      WHERE contact_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `, [contactId, limit]);
    
    return result.rows.reverse();
  } catch (error) {
    console.error('Error getConversationHistory:', error);
    return [];
  }
}

async function saveMessage(contactId, role, message) {
  try {
    await pool.query(`
      INSERT INTO conversation_history (contact_id, role, message, timestamp)
      VALUES ($1, $2, $3, NOW())
    `, [contactId, role, message]);
  } catch (error) {
    console.error('Error saveMessage:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE DETECTION MODULE
// ═══════════════════════════════════════════════════════════════

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
    return { language: 'vi', method: 'VIETNAMESE_CHARS' };
  }
  
  // German structure scoring
  const germanIndicators = {
    articles: ['der', 'die', 'das', 'eine', 'ein', 'einem', 'einer', 'den', 'dem', 'des'],
    modalVerbs: ['würde', 'möchte', 'könnte', 'sollte', 'hätte', 'kann', 'muss', 'will'],
    commonWords: ['gerne', 'auch', 'person', 'personen', 'bitte', 'danke', 'sehr']
  };
  
  let germanScore = 0;
  
  germanIndicators.articles.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) {
      germanScore += 2;
    }
  });
  
  germanIndicators.modalVerbs.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) {
      germanScore += 3;
    }
  });
  
  germanIndicators.commonWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) {
      germanScore += 1;
    }
  });
  
  if (germanScore >= 4) {
    return { language: 'de', method: 'GERMAN_STRUCTURE' };
  }
  
  return null;
}

async function aiLanguageDetection(message, history) {
  try {
    const historyContext = history
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.message)
      .join('\n');
    
    const prompt = `Detect the PRIMARY language of this message.

RULES:
1. Analyze sentence structure, grammar patterns, word order
2. Ignore borrowed words (e.g., "model" appears in all languages)
3. Focus on function words and sentence structure
4. If multiple languages, identify DOMINANT one

${historyContext ? `Previous messages:\n${historyContext}\n\n` : ''}

Current message: "${message}"

Respond with ONLY ONE word: "german", "english", or "vietnamese"`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 10,
      temperature: 0.1
    });
    
    const detected = response.choices[0].message.content.trim().toLowerCase();
    
    const languageMap = {
      'german': 'de',
      'vietnamese': 'vi',
      'english': 'en'
    };
    
    return { 
      language: languageMap[detected] || 'de',
      method: 'AI_DETECTION' 
    };
  } catch (error) {
    console.error('Error aiLanguageDetection:', error);
    return { language: 'de', method: 'ERROR_FALLBACK' };
  }
}

async function detectLanguageFromMessage(message, history) {
  const fastResult = fastLanguageDetection(message);
  if (fastResult) {
    console.log(`✅ Fast detection: ${fastResult.language} (${fastResult.method})`);
    return fastResult.language;
  }
  
  console.log('⏳ Calling AI language detection...');
  const aiResult = await aiLanguageDetection(message, history);
  console.log(`✅ AI detection: ${aiResult.language}`);
  return aiResult.language;
}

async function detectLanguage(message, contactId, history) {
  console.log('\n🌍 === LANGUAGE DETECTION START ===');
  
  // Check for greeting
  const greetingCheck = detectGreeting(message);
  if (greetingCheck.isGreeting) {
    console.log(`✅ Greeting detected: ${greetingCheck.language}`);
    return {
      language: greetingCheck.language,
      method: 'GREETING',
      shouldReset: true
    };
  }
  
  // Get saved language
  const savedLang = await getSavedLanguage(contactId);
  
  // New customer
  if (!savedLang) {
    console.log('🆕 New customer - default: German');
    await createNewCustomer(contactId);
    
    const detectedLang = await detectLanguageFromMessage(message, history);
    
    if (detectedLang !== 'de') {
      console.log(`🔄 Detected ${detectedLang}, updating from default`);
      await updateLanguage(contactId, detectedLang);
      return {
        language: detectedLang,
        method: 'FIRST_TIME_DETECTED',
        shouldReset: false
      };
    }
    
    return {
      language: 'de',
      method: 'DEFAULT',
      shouldReset: false
    };
  }
  
  // Returning customer
  console.log(`📖 Saved language: ${savedLang}`);
  const detectedLang = await detectLanguageFromMessage(message, history);
  
  if (detectedLang === savedLang) {
    console.log(`✅ Language unchanged: ${savedLang}`);
    return {
      language: savedLang,
      method: 'SAVED',
      shouldReset: false
    };
  }
  
  // Language switched
  console.log(`🔄 Language switch: ${savedLang} → ${detectedLang}`);
  await updateLanguage(contactId, detectedLang);
  
  return {
    language: detectedLang,
    method: 'SWITCH',
    shouldReset: false,
    previousLanguage: savedLang
  };
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER CLASSIFICATION MODULE (PURE AI)
// ═══════════════════════════════════════════════════════════════

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
   ✅ "Giá khách mẫu bao nhiêu?" → Asking about MODEL SERVICE PRICE
   ✅ "Tôi muốn làm khách mẫu" → Wants MODEL SERVICE
   ✅ "How much is model service?" → MODEL SERVICE question
   ✅ "Was kostet Modellkunde?" → MODEL SERVICE PRICE
   ✅ "Giá mẫu?" [in service context] → MODEL SERVICE
   ✅ "15€ service" → MODEL SERVICE
   ✅ "Azubi" / "Auszubildende" → MODEL SERVICE

2️⃣ NAIL DESIGN (Mẫu nail):
   → Design patterns, styles
   
   EXAMPLES:
   ❌ "Có mẫu mới không?" → NEW NAIL DESIGNS
   ❌ "Mẫu đẹp quá!" → NAIL DESIGN compliment
   ❌ "Cho tôi xem mẫu" → Show NAIL DESIGNS
   ❌ "New designs please" → NAIL DESIGNS
   ❌ "Neue Muster" → NAIL PATTERNS

═══════════════════════════════════════════════════════════════
HOW TO TELL THEM APART:
═══════════════════════════════════════════════════════════════

MODEL CUSTOMER indicators:
- "khách mẫu" / "model customer" / "modellkunde" (explicit)
- "azubi" / "student practice" (explicit)
- "giá [mẫu/model]" + price context (15€/20€) → service
- Asking about SERVICE (price, time, how it works)

NAIL DESIGN indicators:
- "mẫu mới" / "new designs" (explicit)
- "mẫu đẹp" / "beautiful designs" (explicit)
- "xem mẫu" / "show designs" (explicit)
- Asking about AESTHETICS (beauty, style, patterns)
- Design names: "French", "Ombre", etc.

CONTEXT MATTERS:
- Read conversation history
- "Giá mẫu?" → Usually MODEL SERVICE in salon context
  (nail designs don't have separate pricing)

═══════════════════════════════════════════════════════════════
CLASSIFICATION RULES
═══════════════════════════════════════════════════════════════

→ MODELL: Customer ASKS ABOUT or WANTS model service

→ NORMAL: Everything else (designs, greeting, unclear, etc.)

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
  "contextType": "model_customer" or "nail_design" or "other",
  "keyEvidence": "Specific phrase/context"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error aiClassifyCustomer:', error);
    return {
      classification: 'NORMAL',
      confidence: 0,
      reasoning: 'Error occurred - defaulting to NORMAL',
      contextType: 'error'
    };
  }
}

function validateClassification(aiResult) {
  const CONFIDENCE_THRESHOLD = 75;
  
  if (aiResult.confidence < CONFIDENCE_THRESHOLD) {
    console.log(`⚠️ Low confidence (${aiResult.confidence}%) - defaulting to NORMAL`);
    return {
      customerType: 'NORMAL',
      confidence: 'MEDIUM',
      reason: 'LOW_AI_CONFIDENCE',
      aiReasoning: aiResult.reasoning
    };
  }
  
  if (aiResult.contextType === 'nail_design') {
    return {
      customerType: 'NORMAL',
      confidence: 'HIGH',
      reason: 'NAIL_DESIGN_CONTEXT',
      aiReasoning: aiResult.reasoning
    };
  }
  
  if (aiResult.contextType === 'model_customer' && aiResult.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      customerType: 'MODELL',
      confidence: 'HIGH',
      reason: 'MODEL_CUSTOMER_DETECTED',
      aiReasoning: aiResult.reasoning
    };
  }
  
  if (aiResult.classification === 'MODELL' && aiResult.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      customerType: 'MODELL',
      confidence: 'HIGH',
      reason: 'AI_CLASSIFIED_MODELL',
      aiReasoning: aiResult.reasoning
    };
  }
  
  return {
    customerType: 'NORMAL',
    confidence: 'HIGH',
    reason: 'AI_CLASSIFIED_NORMAL',
    aiReasoning: aiResult.reasoning
  };
}

async function classifyCustomer(message, contactId, history, language) {
  console.log('\n🎯 === CUSTOMER CLASSIFICATION START ===');
  
  const currentFlag = await getCurrentCustomerFlag(contactId);
  console.log(`📖 Current flag: ${currentFlag || 'NONE'}`);
  
  if (currentFlag === 'MODELL') {
    const greetingCheck = detectGreeting(message);
    if (greetingCheck.isGreeting) {
      console.log('🔄 Greeting - RESET: MODELL → NORMAL');
      await updateCustomerFlag(contactId, 'NORMAL');
      return {
        customerType: 'NORMAL',
        confidence: 'HIGH',
        reason: 'GREETING_RESET',
        flagChanged: true
      };
    }
    
    console.log('✅ Keep flag: MODELL');
    return {
      customerType: 'MODELL',
      confidence: 'HIGH',
      reason: 'ALREADY_MODELL',
      flagChanged: false
    };
  }
  
  console.log('🤖 Calling AI classification...');
  const aiResult = await aiClassifyCustomer(message, history, language);
  
  console.log(`AI: ${aiResult.classification} (${aiResult.confidence}%)`);
  console.log(`Context: ${aiResult.contextType}`);
  
  const decision = validateClassification(aiResult);
  
  if (decision.customerType === 'MODELL' && decision.confidence === 'HIGH') {
    console.log('✅ Updating flag: NORMAL → MODELL');
    await updateCustomerFlag(contactId, 'MODELL');
    decision.flagChanged = true;
  } else {
    decision.flagChanged = false;
  }
  
  console.log(`✅ Final: ${decision.customerType}`);
  console.log('=== CUSTOMER CLASSIFICATION END ===\n');
  
  return decision;
}

// ═══════════════════════════════════════════════════════════════
// RESPONSE GENERATION MODULE
// ═══════════════════════════════════════════════════════════════

function buildEnhancedContext(history, currentMessage) {
  const recentFacts = [];
  const entities = {
    hasDate: false,
    hasTime: false,
    hasPriceQuestion: false
  };
  
  const recentMessages = history.slice(-5);
  
  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      // Extract date
      const dateMatch = msg.message.match(/(thứ|monday|tuesday|wednesday|thursday|friday|saturday|sunday|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)/i);
      if (dateMatch) {
        recentFacts.push(`Date mentioned: ${dateMatch[0]}`);
        entities.hasDate = true;
      }
      
      // Extract time
      const timeMatch = msg.message.match(/(\d{1,2}):?(\d{2})?\s*(h|uhr|am|pm|chiều|sáng|trưa)?/i);
      if (timeMatch) {
        recentFacts.push(`Time mentioned: ${timeMatch[0]}`);
        entities.hasTime = true;
      }
      
      // Check price question
      if (msg.message.match(/(giá|price|kostet|bao nhiêu|how much|wie viel)/i)) {
        entities.hasPriceQuestion = true;
      }
    }
  }
  
  // Check current message
  if (currentMessage.match(/(giá|price|kostet|bao nhiêu|how much|wie viel)/i)) {
    entities.hasPriceQuestion = true;
  }
  
  // Determine stage
  let stage = 'inquiry';
  if (history.length === 0) {
    stage = 'first_message';
  } else if (entities.hasDate && entities.hasTime) {
    stage = 'ready_to_book';
  } else if (entities.hasDate || entities.hasTime) {
    stage = 'gathering_details';
  }
  
  const missingInfo = [];
  if (!entities.hasDate) missingInfo.push('date');
  if (!entities.hasTime) missingInfo.push('time');
  
  return {
    recentFacts,
    entities,
    stage,
    missingInfo,
    isFirstMessage: history.length === 0,
    lastBotMessage: history.length > 0 ? history[history.length - 1].message : null
  };
}

function buildOptimizedPrompt(message, context, language, customerType) {
  const langNames = { de: 'German', en: 'English', vi: 'Vietnamese' };
  const langName = langNames[language] || 'German';
  
  const serviceInfo = customerType === 'MODELL' 
    ? 'Model Service: 15-20€, 2-3h, student practice'
    : 'Professional service: Standard prices, quality guaranteed';
  
  const prompt = `You are Nailounge101 AI assistant for a nail salon in Berlin.

═══ CRITICAL RULES ═══

1. LANGUAGE: Respond in ${langName}
2. CONCISE: 2-4 sentences max (mobile)
3. NATURAL: Friendly but professional
4. HELPFUL: Answer directly

═══ CONTEXT ═══

${context.recentFacts.length > 0 ? context.recentFacts.join('\n') : 'No previous context'}

Stage: ${context.stage}
${context.missingInfo.length > 0 ? `Need: ${context.missingInfo.join(', ')}` : 'All info collected'}

═══ SALON INFO ═══

${serviceInfo}

Hours: Mon-Sat 10:00-18:00 | Sun: CLOSED

Booking: https://nailounge101.setmore.com/

═══ VIETNAMESE TIME ═══
2h chiều=14:00 | 3h chiều=15:00 | 4h chiều=16:00

═══ IMPORTANT ═══

- Price question → Give price clearly
- Ready to book → Provide link
- Missing info → Ask naturally
- Don't repeat previous response
- ${context.isFirstMessage ? 'Include greeting' : 'No greeting'}

═══ CUSTOMER MESSAGE ═══

"${message}"

Response (2-4 sentences, ${langName}):`;

  return prompt;
}

async function validateResponse(response, context, language) {
  const issues = [];
  let score = 100;
  
  if (response.length < 20) {
    issues.push('TOO_SHORT');
    score -= 30;
  }
  if (response.length > 1000) {
    issues.push('TOO_LONG');
    score -= 20;
  }
  
  const detectedLang = fastLanguageDetection(response);
  if (detectedLang && detectedLang.language !== language) {
    issues.push('WRONG_LANGUAGE');
    score -= 40;
  }
  
  if (context.entities.hasPriceQuestion) {
    if (!response.match(/\d+\s*€|euro/i)) {
      issues.push('MISSING_PRICE');
      score -= 25;
    }
  }
  
  if (context.lastBotMessage && context.lastBotMessage === response) {
    issues.push('EXACT_REPEAT');
    score -= 35;
  }
  
  return {
    passed: issues.length === 0,
    issues,
    score: Math.max(0, score)
  };
}

function postProcessResponse(response, context, language) {
  let processed = response;
  
  processed = processed.replace(/\s{2,}/g, ' ');
  processed = processed.replace(/\.{2,}/g, '.');
  processed = processed.replace(/([.!?])([A-ZÄÖÜ])/g, '$1 $2');
  
  if (context.stage === 'ready_to_book' && !processed.includes('setmore.com')) {
    const linkText = {
      de: '\n\nHier buchen: https://nailounge101.setmore.com/',
      en: '\n\nBook here: https://nailounge101.setmore.com/',
      vi: '\n\nĐặt lịch: https://nailounge101.setmore.com/'
    };
    processed += linkText[language] || linkText.de;
  }
  
  return processed.trim();
}

function getFallbackResponse(language, customerType) {
  const fallbacks = {
    de: {
      MODELL: 'Vielen Dank für Ihr Interesse an unserem Model-Service! Der Preis beträgt 15-20€ und dauert 2-3 Stunden. Möchten Sie einen Termin buchen?',
      NORMAL: 'Gerne helfen wir Ihnen weiter! Welchen Service möchten Sie buchen? Unsere Öffnungszeiten sind Montag bis Samstag 10:00-18:00 Uhr.'
    },
    en: {
      MODELL: 'Thank you for your interest in our model service! The price is 15-20€ and takes 2-3 hours. Would you like to book an appointment?',
      NORMAL: 'Happy to help! Which service would you like to book? Our hours are Monday-Saturday 10:00-18:00.'
    },
    vi: {
      MODELL: 'Cảm ơn bạn quan tâm dịch vụ khách mẫu! Giá 15-20€, thời gian 2-3 giờ. Bạn muốn đặt lịch không?',
      NORMAL: 'Rất vui được hỗ trợ bạn! Bạn muốn làm dịch vụ nào? Giờ mở cửa: Thứ 2-7 từ 10:00-18:00.'
    }
  };
  
  return fallbacks[language]?.[customerType] || fallbacks.de.NORMAL;
}

async function generateResponse(message, history, language, customerType) {
  console.log('\n🤖 === GENERATING RESPONSE ===');
  
  try {
    const context = buildEnhancedContext(history, message);
    const prompt = buildOptimizedPrompt(message, context, language, customerType);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.2,
      max_tokens: 400,
      presence_penalty: 0.3,
      frequency_penalty: 0.3
    });
    
    let aiResponse = response.choices[0].message.content.trim();
    
    const validation = await validateResponse(aiResponse, context, language);
    
    if (validation.score < 50) {
      console.log('⚠️ Low quality - using fallback');
      aiResponse = getFallbackResponse(language, customerType);
    }
    
    const finalResponse = postProcessResponse(aiResponse, context, language);
    
    console.log('=== RESPONSE GENERATION END ===\n');
    
    return finalResponse;
  } catch (error) {
    console.error('Error generateResponse:', error);
    return getFallbackResponse(language, customerType);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleIncomingMessage(contactId, message) {
  console.log('\n\n🚀 ========== NEW MESSAGE ==========');
  console.log(`Contact: ${contactId}`);
  console.log(`Message: "${message}"`);
  console.log('====================================\n');
  
  try {
    // Get conversation history
    const history = await getConversationHistory(contactId);
    
    // Save incoming message
    await saveMessage(contactId, 'user', message);
    
    // LAYER 1: Language Detection
    const langResult = await detectLanguage(message, contactId, history);
    const language = langResult.language;
    
    console.log(`\n📌 Language: ${language} (${langResult.method})`);
    
    // Reset on greeting
    if (langResult.shouldReset) {
      console.log('🔄 GREETING RESET - Resetting to NORMAL');
      await updateCustomerFlag(contactId, 'NORMAL');
    }
    
    // LAYER 2: Customer Classification
    const classificationResult = await classifyCustomer(message, contactId, history, language);
    
    console.log(`\n📌 Type: ${classificationResult.customerType} (${classificationResult.confidence})`);
    console.log(`📌 Reason: ${classificationResult.reason}`);
    
    // LAYER 3: Generate Response
    let response;
    
    if (classificationResult.customerType === 'MODELL') {
      // Check if just asking about model service (send info message)
      const isModelInquiry = classificationResult.reason === 'MODEL_CUSTOMER_DETECTED' || 
                             classificationResult.reason === 'AI_CLASSIFIED_MODELL';
      
      if (isModelInquiry && history.length < 3) {
        // First time asking about model - send standard message
        response = MODELL_MESSAGE[language];
      } else {
        // Continuing conversation - generate custom response
        response = await generateResponse(message, history, language, 'MODELL');
      }
    } else {
      response = await generateResponse(message, history, language, 'NORMAL');
    }
    
    // Save bot response
    await saveMessage(contactId, 'assistant', response);
    
    console.log('\n✅ ========== FINAL RESPONSE ==========');
    console.log(`Language: ${language}`);
    console.log(`Type: ${classificationResult.customerType}`);
    console.log(`Response: "${response}"`);
    console.log('======================================\n');
    
    return {
      response,
      language,
      customerType: classificationResult.customerType,
      metadata: {
        reason: classificationResult.reason,
        confidence: classificationResult.confidence
      }
    };
    
  } catch (error) {
    console.error('❌ ERROR in handleIncomingMessage:', error);
    
    return {
      response: getFallbackResponse('de', 'NORMAL'),
      language: 'de',
      customerType: 'NORMAL',
      error: error.message
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

app.post('/webhook', async (req, res) => {
  try {
    const { contact_id, message } = req.body;
    
    if (!contact_id || !message) {
      return res.status(400).json({ 
        error: 'Missing contact_id or message' 
      });
    }
    
    const result = await handleIncomingMessage(contact_id, message);
    
    res.json({
      success: true,
      response: result.response,
      language: result.language,
      customerType: result.customerType,
      metadata: result.metadata
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

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

const PORT = process.env.PORT || 3000;

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
