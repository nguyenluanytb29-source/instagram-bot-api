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

// ═══════════════════════════════════════════════════════════════
// MODELL FLOW MESSAGES — 3 STEPS × 3 LANGUAGES
// ═══════════════════════════════════════════════════════════════

// ── STEP 1: Initial service info ─────────────────────────────────────────────

const MODELL_STEP1 = {
  de: `Guten Tag! 😊 Vielen Dank für Ihr Interesse an unseren Dienstleistungen. Zurzeit suchen wir noch Modelle für unsere Schüler. Der Preis richtet sich nach dem Design:

• Natur (klar): 15 €
• Natur Make-up, French, Farbe, Glitzer, Ombre oder Cat-Eye: 20 €

Für aufwendigere Designs berechnen wir zusätzlich:
• 1 € pro Design-Nagel
• 0,50 € pro Steinchen

Bitte beachten Sie: Da die Behandlung von einem Schüler durchgeführt wird, kann es sein, dass sehr komplizierte Designs nicht möglich sind. Die Behandlungszeit beträgt normalerweise etwa 2–3 Stunden. Das Ergebnis ist eventuell nicht perfekt, da es sich um eine Übung handelt – wir möchten Sie darüber im Voraus informieren. Falls etwas nicht zufriedenstellend ist, bieten wir innerhalb von 3 Tagen eine kostenlose Nachbesserung an.

Wäre das für Sie in Ordnung? 💅 Wenn alles für Sie passt, können wir gerne einen Termin vereinbaren.`,

  en: `Hello! 😊 Thank you for your interest in our services. We are currently looking for models for our students. The price depends on the design:

• Natural (clear): €15
• Natural make-up, French, colour, glitter, ombre or cat-eye: €20

For more elaborate designs, we charge additionally:
• €1 per design nail
• €0.50 per rhinestone

Please note: As the treatment is carried out by a student, very complex designs may not be possible. The treatment usually takes around 2–3 hours. The result may not be perfect as it is a practice session – we want to let you know in advance. If anything is unsatisfactory, we offer a free touch-up within 3 days.

Does that sound good to you? 💅 If everything works for you, we'd be happy to arrange an appointment.`,

  vi: `Xin chào! 😊 Cảm ơn bạn đã quan tâm đến dịch vụ của chúng tôi. Hiện tại chúng tôi đang tìm khách mẫu cho học viên. Giá tùy theo mẫu thiết kế:

• Tự nhiên (trong): 15 €
• Tự nhiên make-up, French, màu, nhũ, ombre hoặc cat-eye: 20 €

Với những thiết kế phức tạp hơn, chúng tôi tính thêm:
• 1 € mỗi móng có họa tiết
• 0,50 € mỗi đá đính

Lưu ý: Vì dịch vụ do học viên thực hiện, các thiết kế quá phức tạp có thể không thực hiện được. Thời gian làm thường khoảng 2–3 tiếng. Kết quả có thể không hoàn hảo vì đây là buổi thực hành – chúng tôi muốn thông báo trước để bạn biết. Nếu có điều gì chưa ưng ý, chúng tôi sẽ sửa miễn phí trong vòng 3 ngày.

Bạn thấy ổn không? 💅 Nếu mọi thứ phù hợp, chúng ta có thể đặt lịch hẹn nhé.`
};

// ── STEP 2: Booking link (after customer agrees) ──────────────────────────────

const MODELL_STEP2 = {
  de: `Super, das freut uns sehr! 🎉

Da wir nur wenige Modellplätze haben, empfehlen wir Ihnen, den Termin direkt online zu buchen. Hier können Sie Ihren Termin reservieren:
https://nailounge101.setmore.com/team/jeeZoVSakEm9KfPuHaC7ZwfaPN9CKI1R

Modell-Termine werden ausschließlich online gebucht und müssen im Voraus bezahlt werden, damit der Termin verbindlich für Sie reserviert ist. Ohne Vorauszahlung kann der Termin leider nicht reserviert werden. Nur vollständig bezahlte Termine werden bestätigt.

Bitte beachten Sie:
• Terminbuchung nur online möglich.
• Vorauszahlung ist erforderlich, um den Termin verbindlich zu reservieren.

Stornierungsbedingungen: Wenn Sie nicht zum Termin erscheinen oder weniger als 24 Stunden vorher absagen, ist eine Rückerstattung leider nicht möglich.

Die Plätze für Modelle sind begrenzt und oft schnell vergeben.

Wir freuen uns auf Ihren Besuch bei Nailounge101! 💅`,

  en: `That's wonderful, we're so pleased! 🎉

As we only have a limited number of model spots, we recommend booking your appointment directly online. You can reserve your spot here:
https://nailounge101.setmore.com/team/jeeZoVSakEm9KfPuHaC7ZwfaPN9CKI1R

Model appointments are booked exclusively online and must be paid in advance to secure your reservation. Without prepayment, unfortunately we cannot hold the appointment. Only fully paid appointments will be confirmed.

Please note:
• Booking is only possible online.
• Prepayment is required to secure your appointment.

Cancellation policy: If you do not show up or cancel less than 24 hours in advance, a refund will unfortunately not be possible.

Model spots are limited and fill up quickly.

We look forward to your visit at Nailounge101! 💅`,

  vi: `Tuyệt vời, chúng tôi rất vui! 🎉

Vì chỉ có ít chỗ cho khách mẫu, chúng tôi khuyên bạn đặt lịch trực tiếp online. Bạn có thể đặt chỗ tại đây:
https://nailounge101.setmore.com/team/jeeZoVSakEm9KfPuHaC7ZwfaPN9CKI1R

Lịch khách mẫu chỉ đặt online và cần thanh toán trước để giữ chỗ. Nếu không thanh toán trước, chúng tôi không thể giữ lịch cho bạn. Chỉ những lịch đã thanh toán đầy đủ mới được xác nhận.

Lưu ý:
• Chỉ đặt lịch online.
• Bắt buộc thanh toán trước để giữ chỗ.

Chính sách huỷ: Nếu bạn không đến hoặc huỷ trước dưới 24 giờ, chúng tôi không thể hoàn tiền.

Chỗ khách mẫu có hạn và thường hết nhanh.

Chúng tôi mong được đón bạn tại Nailounge101! 💅`
};

// ── STEP 3: Prepayment explanation ───────────────────────────────────────────

const MODELL_STEP3 = {
  de: `Wir bitten um Vorauszahlung, da Modell-Termine sehr lange dauern (ca. 2–3 Stunden) und wir nur wenige Plätze für unsere Schüler haben. So können wir sicherstellen, dass der Termin wirklich für Sie reserviert ist.

Vielen Dank für Ihr Verständnis! 😊 Leider hatten wir in der Vergangenheit viele Termin-Ausfälle, daher ist die Vorauszahlung für Modell-Termine notwendig.`,

  en: `We ask for prepayment because model appointments take a long time (approx. 2–3 hours) and we only have a few spots available for our students. This ensures your appointment is genuinely reserved for you.

Thank you for your understanding! 😊 Unfortunately we've had many no-shows in the past, which is why prepayment is required for model appointments.`,

  vi: `Chúng tôi yêu cầu thanh toán trước vì lịch khách mẫu kéo dài khá lâu (khoảng 2–3 tiếng) và chỉ có ít chỗ cho học viên. Điều này giúp đảm bảo lịch hẹn thực sự được giữ cho bạn.

Cảm ơn bạn đã thông cảm! 😊 Tiếc là trước đây chúng tôi có nhiều trường hợp khách không đến, vì vậy thanh toán trước là bắt buộc cho lịch khách mẫu.`
};

// ── Helpers to pick the right language ───────────────────────────────────────
const MODELL_MESSAGE         = MODELL_STEP1.de; // legacy alias (DE default)
const MODELL_MESSAGE_EN      = MODELL_STEP1.en; // legacy alias
const MODELL_MESSAGE_VI      = MODELL_STEP1.vi; // legacy alias
const MODELL_BOOKING_MESSAGE = MODELL_STEP2.de; // legacy alias
const MODELL_PREPAYMENT_REASON = MODELL_STEP3.de; // legacy alias

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

// ═══════════════════════════════════════════════════════════════
// NORMAL CUSTOMER FLOW HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * A returning customer has prior assistant messages saved in DB.
 * history here = rows from getChatHistory (all past messages loaded
 * BEFORE the current turn).
 */
function isReturningCustomer(history) {
  return history.some(msg => msg.role === 'assistant');
}

/**
 * Use AI to detect if the customer is trying to book an appointment
 * and extract the requested date/time if present.
 * Returns: { isBooking: bool, datetime: string|null }
 */
async function detectBookingRequest(message, language, history) {
  try {
    const recentHistory = history.slice(-6).map(m => `[${m.role}]: ${m.message}`).join('\n');
    const prompt = `You are analyzing a message from a nail salon customer to detect booking intent.

Conversation context:
${recentHistory || '[No prior messages]'}

Current message: "${message}"

Task:
1. Does the customer want to book / request an appointment? (yes/no)
2. If yes, extract the requested date and/or time from the message. Use 24h format for time. If only a day name is given (e.g. "Montag", "Monday", "thứ 2"), note it as-is. If no date/time mentioned, set datetime to null.

Respond ONLY with valid JSON:
{
  "isBooking": true or false,
  "datetime": "extracted date/time string" or null,
  "summary": "one short sentence describing the request in German"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error detectBookingRequest:', error);
    return { isBooking: false, datetime: null, summary: '' };
  }
}

/**
 * Append booking info to the conversation_summary so staff can see it.
 */
async function saveBookingToSummary(contactId, userName, bookingInfo) {
  try {
    const existing = await pool.query(
      'SELECT summary FROM conversation_summary WHERE contact_id = $1',
      [contactId]
    );
    const existingText = existing.rows.length > 0 ? existing.rows[0].summary || '' : '';
    const bookingNote = `[TERMINWUNSCH] ${bookingInfo.datetime ? bookingInfo.datetime + ' — ' : ''}${bookingInfo.summary}`;
    const newSummary = existingText
      ? `${existingText}\n${bookingNote}`
      : bookingNote;

    await pool.query(`
      INSERT INTO conversation_summary (contact_id, user_name, summary, last_updated)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (contact_id)
      DO UPDATE SET summary = $3, user_name = $2, last_updated = NOW()
    `, [contactId, userName, newSummary]);

    console.log('✅ Booking note saved to summary');
  } catch (error) {
    console.error('Error saveBookingToSummary:', error);
  }
}

async function generateAIResponse(message, history, language, customerType, isReturning = false) {
  console.log('\n🤖 === GENERATING AI RESPONSE ===');
  
  const historyText = formatHistory(history);
  
  const serviceInfo = customerType === 'MODELL' 
    ? 'Model Service: 15-20€, 2-3h, student practice'
    : 'Professional service: standard prices, quality guaranteed';
  
  const langNames = { de: 'German', en: 'English', vi: 'Vietnamese' };
  const langName = langNames[language] || 'German';

  const toneInstruction = isReturning
    ? `TONE: This is a RETURNING customer — speak warmly and naturally like you know them. Use casual, friendly language (du/bạn/you). Skip stiff greetings. Keep it personal and relaxed.`
    : `TONE: New customer — friendly but professional.`;

  const systemPrompt = `You are Nailounge101 AI assistant for a nail salon in Berlin.

CRITICAL RULES:
1. LANGUAGE: Respond in ${langName} only
2. CONCISE: 2-4 sentences max (mobile users)
3. HELPFUL: Answer directly
4. ${toneInstruction}

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
      temperature: isReturning ? 0.4 : 0.2,
      max_tokens: 400
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating response:', error);
    
    const fallbacks = {
      de: 'Entschuldigung, ich hatte ein technisches Problem. Wie kann ich Ihnen helfen?',
      en: 'Sorry, I had a technical issue. How can I help you?',
      vi: 'Xin lỗi, tôi gặp sự cố kỹ thuật. Tôi có thể giúp gì cho bạn?'
    };
    
    return fallbacks[language] || fallbacks.de;
  }
}


// ═══════════════════════════════════════════════════════════════
// MODELL FLOW DETECTION HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if the bot has already sent the initial MODELL info message
 * (Step 1 with price list and "Wäre das für Sie in Ordnung?")
 */
function hasModellInfoBeenSent(history) {
  return history.some(msg =>
    msg.role === 'assistant' &&
    (msg.message.includes('Natur (klar): 15') ||
     msg.message.includes('Wäre das für Sie in Ordnung') ||
     msg.message.includes('Schüler') ||
     msg.message.includes('Modellkunde') ||
     msg.message.includes('Model Customer') ||
     msg.message.includes('Khách Mẫu'))
  );
}

/**
 * Check if the bot has already sent the booking link (Step 2)
 */
function hasBookingLinkBeenSent(history) {
  return history.some(msg =>
    msg.role === 'assistant' &&
    msg.message.includes('nailounge101.setmore.com/team/')
  );
}

/**
 * Detect if the customer is agreeing / saying yes to the model service offer.
 * Covers German, English and Vietnamese affirmations.
 */
function isCustomerAgreeing(message) {
  const lower = message.toLowerCase().trim();
  const agreementPatterns = [
    // German
    'ja', 'ok', 'okay', 'in ordnung', 'klar', 'natürlich', 'gerne',
    'super', 'perfekt', 'ja bitte', 'ja das passt', 'das passt',
    'einverstanden', 'stimmt', 'alles klar', 'ja gerne', 'klingt gut',
    'das klingt gut', 'passt', 'ja passt',
    // English
    'yes', 'sure', 'sounds good', 'that works', 'agreed', "i'm in",
    'perfect', 'great',
    // Vietnamese
    'được', 'đồng ý', 'vâng', 'dạ', 'oke', 'tốt', 'được ạ', 'ok'
  ];
  return agreementPatterns.some(p =>
    lower === p ||
    lower.startsWith(p + ' ') ||
    lower.startsWith(p + ',') ||
    lower.startsWith(p + '!') ||
    lower.startsWith(p + '.')
  );
}

/**
 * Detect if the customer is asking WHY they need to pay in advance.
 */
function isAskingAboutPrepayment(message) {
  const lower = message.toLowerCase();
  const prepaymentPatterns = [
    // German
    'warum vorauszahlung', 'wieso vorauszahlung', 'weshalb vorauszahlung',
    'warum im voraus', 'wieso im voraus', 'warum muss ich zahlen',
    'warum bezahlen', 'wieso bezahlen', 'warum vorher',
    'vorauszahlung warum', 'vorab zahlen warum', 'wieso vorher',
    'warum zahlen',
    // English
    'why prepay', 'why pay in advance', 'why pay upfront', 'why do i have to pay',
    'why must i pay', 'reason for prepayment',
    // Vietnamese
    'tại sao phải trả trước', 'vì sao trả trước', 'tại sao cần đặt cọc',
    'sao phải thanh toán trước', 'tại sao phải thanh toán', 'lý do trả trước'
  ];
  return prepaymentPatterns.some(p => lower.includes(p));
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
      const infoAlreadySent    = hasModellInfoBeenSent(history);
      const bookingAlreadySent = hasBookingLinkBeenSent(history);

      // STEP 3: Customer asks why prepayment is required
      if (bookingAlreadySent && isAskingAboutPrepayment(user_message)) {
        botResponse = MODELL_STEP3[userLang] || MODELL_STEP3.de;
        console.log(`📤 Sending MODELL STEP 3 (${userLang}): prepayment explanation`);

      // STEP 2: Customer agrees after seeing info → send booking link
      } else if (infoAlreadySent && !bookingAlreadySent && isCustomerAgreeing(user_message)) {
        botResponse = MODELL_STEP2[userLang] || MODELL_STEP2.de;
        console.log(`📤 Sending MODELL STEP 2 (${userLang}): booking link`);

      // STEP 1: First contact – send service info with prices
      } else if (!infoAlreadySent) {
        botResponse = MODELL_STEP1[userLang] || MODELL_STEP1.de;
        console.log(`📤 Sending MODELL STEP 1 (${userLang}): service info`);

      // Follow-up: anything else → AI handles it
      } else {
        botResponse = await generateAIResponse(user_message, history, userLang, 'MODELL');
        console.log('📤 MODELL follow-up: AI response');
      }

    } else {
      // ── NORMAL CUSTOMER FLOW ─────────────────────────────────────
      const returning = isReturningCustomer(history);
      console.log(`\n📌 Returning customer: ${returning}`);

      // Check if customer is trying to book an appointment
      const bookingResult = await detectBookingRequest(user_message, userLang, history);
      console.log(`📌 Booking detected: ${bookingResult.isBooking}, datetime: ${bookingResult.datetime}`);

      if (bookingResult.isBooking) {
        // Save booking request to summary for staff
        await saveBookingToSummary(contact_id, user_name, bookingResult);

        // Generate confirmation reply in customer's language
        const bookingConfirmPrompts = {
          de: `Bestätige dem Kunden kurz und herzlich, dass du den Terminwunsch (${bookingResult.datetime || 'ohne genaue Zeit'}) notiert hast und dass ein Mitarbeiter den Kalender prüfen und sich melden wird. Sei warm${returning ? ' und vertraut' : ''}. Max 3 Sätze auf Deutsch.`,
          en: `Briefly and warmly confirm to the customer that you've noted their appointment request (${bookingResult.datetime || 'no specific time given'}) and that a team member will check the calendar and get back to them. Be friendly${returning ? ' and casual' : ''}. Max 3 sentences in English.`,
          vi: `Xác nhận ngắn gọn và thân thiện với khách rằng bạn đã ghi nhận yêu cầu đặt lịch (${bookingResult.datetime || 'chưa có thời gian cụ thể'}) và nhân viên sẽ kiểm tra lịch rồi phản hồi lại. Tone${returning ? ' thân mật' : ' thân thiện'}. Tối đa 3 câu bằng tiếng Việt.`
        };

        const confirmPrompt = bookingConfirmPrompts[userLang] || bookingConfirmPrompts.de;

        try {
          const confirmRes = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'system', content: confirmPrompt }],
            temperature: returning ? 0.4 : 0.2,
            max_tokens: 200
          });
          botResponse = confirmRes.choices[0].message.content.trim();
        } catch (err) {
          // Fallback hardcoded confirmation
          const fallbackConfirm = {
            de: `Alles klar${returning ? ' 😊' : '!'} Ich habe deinen Terminwunsch für ${bookingResult.datetime || 'den gewünschten Termin'} notiert. Unser Team prüft den Kalender und meldet sich bei dir. Danke! 💅`,
            en: `Got it${returning ? ' 😊' : '!'} I've noted your appointment request for ${bookingResult.datetime || 'your preferred time'}. Our team will check the calendar and get back to you. Thanks! 💅`,
            vi: `Được rồi${returning ? ' 😊' : '!'} Mình đã ghi nhận yêu cầu đặt lịch ${bookingResult.datetime || 'của bạn'} rồi nhé. Nhân viên sẽ kiểm tra lịch và phản hồi lại bạn sớm. Cảm ơn bạn! 💅`
          };
          botResponse = fallbackConfirm[userLang] || fallbackConfirm.de;
        }
        console.log('📤 Booking confirmation sent');

      } else {
        // Regular conversation — use AI with tone based on returning status
        botResponse = await generateAIResponse(user_message, history, userLang, 'NORMAL', returning);
      }
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
