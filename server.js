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
  de: `Guten Tag! 😊

Vielen Dank für Ihr Interesse an unseren Dienstleistungen.
Zurzeit suchen wir noch Modelle für unsere Schüler.

Der Preis richtet sich nach dem Design:
• Natur (klar): 15 €
• Natur Make-up, French, Farbe, Glitzer, Ombre oder Cat-Eye: 20 €

Für aufwendigere Designs berechnen wir zusätzlich:
• 1 € pro Design-Nagel
• 0,50 € pro Steinchen

Bitte beachten Sie:
Da die Behandlung von einem Schüler durchgeführt wird, kann es sein, dass sehr komplizierte Designs nicht möglich sind.
Die Behandlungszeit beträgt normalerweise etwa 2–3 Stunden.
Das Ergebnis ist eventuell nicht perfekt, da es sich um eine Übung handelt – wir möchten Sie darüber im Voraus informieren.
Falls etwas nicht zufriedenstellend ist, bieten wir innerhalb von 3 Tagen eine kostenlose Nachbesserung an.

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
  de: `Super, das freut uns sehr! 😊

Da wir nur wenige Modellplätze haben, empfehlen wir Ihnen, den Termin direkt online zu buchen.
Hier können Sie Ihren Termin reservieren:
https://nailounge101.setmore.com/team/jeeZoVSakEm9KfPuHaC7ZwfaPN9CKI1R

Modell-Termine werden ausschließlich online gebucht und müssen im Voraus bezahlt werden, damit der Termin verbindlich für Sie reserviert ist.
Ohne Vorauszahlung kann der Termin leider nicht reserviert werden.
Nur vollständig bezahlte Termine werden bestätigt.

Bitte beachten Sie:
• Terminbuchung nur online möglich.
• Vorauszahlung ist erforderlich, um den Termin verbindlich zu reservieren.

Stornierungsbedingungen:
Wenn Sie nicht zum Termin erscheinen oder weniger als 24 Stunden vorher absagen, ist eine Rückerstattung leider nicht möglich.

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
  de: `Wir bitten um Vorauszahlung, da Modell-Termine sehr lange dauern (ca. 2–3 Stunden) und wir nur wenige Plätze für unsere Schüler haben.
So können wir sicherstellen, dass der Termin wirklich für Sie reserviert ist.

Vielen Dank für Ihr Verständnis! 😊
Leider hatten wir in der Vergangenheit viele Termin-Ausfälle, daher ist die Vorauszahlung für Modell-Termine notwendig.`,

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
   ✅ "Ich interessiere mich für Modell" → MODEL SERVICE
   ✅ "Ich interessiere mich für das Modellangebot" → MODEL SERVICE
   ✅ "Modell buchen" / "Modelltermin" → MODEL SERVICE
   ✅ "Bin ich als Modell geeignet?" → MODEL SERVICE
   ✅ "Giá mẫu?" [in service context] → MODEL SERVICE
   ✅ "Azubi" / "Auszubildende" → MODEL SERVICE
   ✅ "model customer" / "modell kunde" → MODEL SERVICE

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

// Keywords that always indicate MODELL intent (no AI needed)
// Grouped by language for maintainability
const MODELL_KEYWORDS = [
  // ── German ────────────────────────────────────────────────────
  'modell',           // catches modellkunde, modelltermin, modellplatz, modellpreis etc.
  'azubi',
  'auszubildende',
  'auszubildenden',
  'schüler',          // "von einem Schüler"
  'übungsmodell',
  'lernmodell',
  'günstiger service',
  'günstiger termin',
  'preiswert',        // "preiswerte Behandlung"

  // ── English ───────────────────────────────────────────────────
  'model service',
  'model customer',
  'model appointment',
  'practice model',
  'training model',
  'student model',
  'student practice',
  'model client',
  'model nail',       // "model nail appointment"
  'cheap service',    // uncommon but possible
  'discounted service',

  // ── Vietnamese ────────────────────────────────────────────────
  'khách mẫu',
  'làm mẫu',
  'mẫu thực hành',
  'dịch vụ mẫu',
  'giá mẫu',
  'học viên',
  // Note: 'thực hành', 'sinh viên', 'rẻ hơn', 'giá rẻ' intentionally excluded
  // — too broad, high false-positive risk → let AI handle these
];

async function classifyCustomer(message, contactId, history, language) {
  console.log('\n🎯 === CUSTOMER CLASSIFICATION ===');
  
  const currentFlag = await getCurrentCustomerFlag(contactId);
  console.log(`📖 Current flag: ${currentFlag || 'NONE'}`);

  // ── Keyword shortcut: skip AI if message clearly mentions model service ──
  const msgLower = message.toLowerCase();
  const hasModellKeyword = MODELL_KEYWORDS.some(k => msgLower.includes(k));
  if (hasModellKeyword && currentFlag !== 'NORMAL') {
    console.log('✅ Keyword match → MODELL (no AI call needed)');
    await updateCustomerFlag(contactId, 'MODELL');
    return 'MODELL';
  }

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
// BOT PAUSE HELPERS (/stop keyword)
// ═══════════════════════════════════════════════════════════════

/**
 * Set bot pause for a contact for 24 hours.
 * Uses conversation_summary table with a dedicated pause column,
 * or a simple upsert into a bot_pause table created on first use.
 */
async function pauseBot(contactId) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_pause (
        contact_id TEXT PRIMARY KEY,
        paused_until TIMESTAMPTZ NOT NULL
      )
    `);
    const pausedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h
    await pool.query(`
      INSERT INTO bot_pause (contact_id, paused_until)
      VALUES ($1, $2)
      ON CONFLICT (contact_id)
      DO UPDATE SET paused_until = $2
    `, [contactId, pausedUntil]);
    console.log(`⏸️  Bot paused for ${contactId} until ${pausedUntil.toISOString()}`);
  } catch (error) {
    console.error('Error pauseBot:', error);
  }
}

/**
 * Check if bot is currently paused for a contact.
 * Returns true if still within the 24h window.
 */
async function isBotPaused(contactId) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_pause (
        contact_id TEXT PRIMARY KEY,
        paused_until TIMESTAMPTZ NOT NULL
      )
    `);
    const result = await pool.query(
      'SELECT paused_until FROM bot_pause WHERE contact_id = $1',
      [contactId]
    );
    if (result.rows.length === 0) return false;
    return new Date(result.rows[0].paused_until) > new Date();
  } catch (error) {
    console.error('Error isBotPaused:', error);
    return false; // fail open — bot continues if DB error
  }
}

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
 * Use AI to analyse a customer message and detect:
 * - isBooking      : customer wants to make an appointment
 * - datetime       : extracted date/time string (null if not mentioned)
 * - isSelfBooking  : customer says they will book themselves via link
 * - isAssistedBooking: customer explicitly asks us to book for them
 * - summary        : one German sentence describing the request
 */
async function detectBookingIntent(message, history) {
  try {
    const recentHistory = history.slice(-6).map(m => `[${m.role}]: ${m.message}`).join('\n');
    const prompt = `You are analysing a message from a nail salon customer.

Conversation context:
${recentHistory || '[No prior messages]'}

Current message: "${message}"

Determine:
1. isBooking: does the customer want to make / ask about an appointment? (true/false)
2. datetime: extract requested date and/or time (24h format). Day names are fine as-is. null if not mentioned.
3. isSelfBooking: does the customer say they will book themselves (e.g. "I'll book via the link", "ich buche selbst", "tự đặt")? (true/false)
4. isAssistedBooking: does the customer explicitly ask us to book FOR them (e.g. "please book for me", "buch für mich", "đặt giùm mình")? (true/false)
5. summary: one short sentence in German describing the booking request.

Respond ONLY with valid JSON (no markdown):
{
  "isBooking": true or false,
  "datetime": "string or null",
  "isSelfBooking": true or false,
  "isAssistedBooking": true or false,
  "summary": "German sentence"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error detectBookingIntent:', error);
    return { isBooking: false, datetime: null, isSelfBooking: false, isAssistedBooking: false, summary: '' };
  }
}

/**
 * Check if bot has already sent the "self-book or assisted?" question in this conversation.
 */
function hasAskedBookingPreference(history) {
  return history.some(msg =>
    msg.role === 'assistant' &&
    (msg.message.includes('nailounge101.setmore.com') ||
     msg.message.includes('selbst buchen') ||
     msg.message.includes('book yourself') ||
     msg.message.includes('tự đặt') ||
     msg.message.includes('đặt giùm'))
  );
}

/**
 * Append assisted booking request to conversation_summary for staff.
 */
async function saveBookingToSummary(contactId, userName, bookingInfo) {
  try {
    const existing = await pool.query(
      'SELECT summary FROM conversation_summary WHERE contact_id = $1',
      [contactId]
    );
    const existingText = existing.rows.length > 0 ? existing.rows[0].summary || '' : '';
    const bookingNote = `[TERMINWUNSCH] ${bookingInfo.datetime ? bookingInfo.datetime + ' — ' : ''}${bookingInfo.summary}`;
    const newSummary = existingText ? `${existingText}\n${bookingNote}` : bookingNote;

    await pool.query(`
      INSERT INTO conversation_summary (contact_id, user_name, summary, last_updated)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (contact_id)
      DO UPDATE SET summary = $3, user_name = $2, last_updated = NOW()
    `, [contactId, userName, newSummary]);

    console.log('✅ Assisted booking note saved to summary');
  } catch (error) {
    console.error('Error saveBookingToSummary:', error);
  }
}

/**
 * Validate a booking datetime string extracted by AI.
 * Returns: { valid: bool, reason: 'past' | 'sunday' | 'outside_hours' | null }
 *
 * Opening hours:
 *   Mon–Fri : 09:30–19:00
 *   Saturday: 09:30–16:00
 *   Sunday  : CLOSED
 */
function validateBookingDatetime(datetimeStr) {
  if (!datetimeStr) return { valid: true, reason: null };

  const now = new Date();

  // Normalise German/Vietnamese day names → English
  const dayMap = {
    'montag': 'Monday', 'dienstag': 'Tuesday', 'mittwoch': 'Wednesday',
    'donnerstag': 'Thursday', 'freitag': 'Friday', 'samstag': 'Saturday',
    'sonntag': 'Sunday',
    'thứ 2': 'Monday', 'thứ hai': 'Monday',
    'thứ 3': 'Tuesday', 'thứ ba': 'Tuesday',
    'thứ 4': 'Wednesday', 'thứ tư': 'Wednesday',
    'thứ 5': 'Thursday', 'thứ năm': 'Thursday',
    'thứ 6': 'Friday', 'thứ sáu': 'Friday',
    'thứ 7': 'Saturday', 'thứ bảy': 'Saturday',
    'chủ nhật': 'Sunday', 'cn': 'Sunday'
  };

  let normalised = datetimeStr.toLowerCase();
  for (const [foreign, english] of Object.entries(dayMap)) {
    normalised = normalised.replace(foreign, english);
  }
  // "9h" / "9h30" → "9:00" / "9:30"
  normalised = normalised.replace(/(\d{1,2})h(\d{2})?/g, (_, h, m) => `${h}:${m || '00'}`);

  // ── Sunday check by keyword ──────────────────────────────────────────────
  const sundayKeywords = ['sunday', 'sonntag', 'chủ nhật', ' cn '];
  if (sundayKeywords.some(k => normalised.includes(k))) {
    return { valid: false, reason: 'sunday' };
  }

  // ── Detect if it's a Saturday ────────────────────────────────────────────
  const isSaturdayKeyword = ['saturday', 'samstag', 'thứ 7', 'thứ bảy'].some(k => normalised.includes(k));

  // ── Extract time ─────────────────────────────────────────────────────────
  const timeMatch = normalised.match(/(\d{1,2}):(\d{2})/);
  const hour   = timeMatch ? parseInt(timeMatch[1], 10) : null;
  const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;

  if (hour !== null) {
    const totalMinutes = hour * 60 + minute;
    const openMinutes  = 9 * 60 + 30;  // 09:30

    // Saturday closes at 16:00, Mon–Fri closes at 19:00
    let closeMinutes;
    if (isSaturdayKeyword) {
      closeMinutes = 16 * 60;
    } else {
      closeMinutes = 19 * 60;
    }

    if (totalMinutes < openMinutes || totalMinutes >= closeMinutes) {
      return { valid: false, reason: 'outside_hours' };
    }
  }

  // ── Full date parse for past-date and Saturday-by-date checks ────────────
  const parsed = new Date(normalised);
  if (!isNaN(parsed.getTime())) {
    const dayOfWeek = parsed.getDay(); // 0=Sun, 6=Sat

    if (dayOfWeek === 0) return { valid: false, reason: 'sunday' };

    // Re-check time against Saturday closing if day resolved to Saturday
    if (dayOfWeek === 6 && hour !== null) {
      const totalMinutes = hour * 60 + minute;
      if (totalMinutes >= 16 * 60) return { valid: false, reason: 'outside_hours' };
    }

    // Past-date check (allow same-day)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (parsed < startOfToday) return { valid: false, reason: 'past' };
  }

  return { valid: true, reason: null };
}

/**
 * Build a friendly "invalid datetime" reply in the customer's language.
 */
function buildInvalidDatetimeReply(reason, lang, returning) {
  const hours = 'Mo–Fr: 09:30–19:00 Uhr | Sa: 09:30–16:00 Uhr | So: geschlossen';
  const hoursEn = 'Mon–Fri: 09:30–19:00 | Sat: 09:30–16:00 | Sun: closed';
  const hoursVi = 'Thứ 2–Thứ 6: 9:30–19:00 | Thứ 7: 9:30–16:00 | Chủ nhật: nghỉ';

  const messages = {
    past: {
      de: returning
        ? `Hey, das Datum liegt leider schon in der Vergangenheit 😅 Wann möchtest du kommen? Wir sind ${hours}.`
        : `Das gewünschte Datum liegt leider in der Vergangenheit. Wann dürfen wir Sie erwarten? Unsere Öffnungszeiten: ${hours}.`,
      en: returning
        ? `Hey, that date has already passed 😅 When would you like to come? We're open ${hoursEn}.`
        : `The date you mentioned has already passed. When would you like to visit us? Our opening hours: ${hoursEn}.`,
      vi: returning
        ? `Hey, ngày đó đã qua rồi nha 😅 Bạn muốn đến ngày nào? Mình mở cửa ${hoursVi}.`
        : `Ngày bạn chọn đã qua rồi ạ. Bạn muốn đặt lịch vào ngày nào? Giờ làm việc của mình: ${hoursVi}.`
    },
    sunday: {
      de: returning
        ? `Sonntags haben wir leider zu 😔 Wir sind ${hours} – magst du einen anderen Tag wählen?`
        : `Sonntags sind wir leider geschlossen. Unsere Öffnungszeiten: ${hours}. Wann darf ich Sie einplanen?`,
      en: returning
        ? `We're closed on Sundays 😔 We're open ${hoursEn} – can you pick another day?`
        : `Unfortunately we're closed on Sundays. Our opening hours: ${hoursEn}. When would you like to come?`,
      vi: returning
        ? `Chủ nhật mình nghỉ rồi 😔 Mình mở cửa ${hoursVi} – bạn chọn ngày khác nhé?`
        : `Chủ nhật chúng mình nghỉ ạ. Giờ làm việc: ${hoursVi}. Bạn muốn đặt ngày nào khác không?`
    },
    outside_hours: {
      de: returning
        ? `Zu der Uhrzeit haben wir leider nicht geöffnet 😔 Wir sind ${hours} – magst du eine andere Uhrzeit wählen?`
        : `Zu dieser Uhrzeit sind wir leider nicht geöffnet. Unsere Öffnungszeiten: ${hours}. Wann darf ich Sie einplanen?`,
      en: returning
        ? `We're not open at that time 😔 Our hours are ${hoursEn} – can you pick another time?`
        : `We're not open at that time. Our opening hours: ${hoursEn}. When would you like to come?`,
      vi: returning
        ? `Giờ đó mình chưa mở cửa 😔 Giờ làm việc: ${hoursVi} – bạn chọn giờ khác nhé?`
        : `Giờ đó chúng mình chưa mở cửa ạ. Giờ làm việc: ${hoursVi}. Bạn muốn đặt giờ nào khác không?`
    }
  };

  const map = messages[reason] || messages.outside_hours;
  return (map[lang] || map.de);
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
Hours: Mon–Fri 09:30–19:00 | Sat 09:30–16:00 | Sun: CLOSED
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

    // ── /stop keyword: staff triggers 24h pause ──────────────────
    if (user_message.trim().toLowerCase() === '/stop') {
      await pauseBot(contact_id);
      return res.json({
        bot_response: 'EMPTY_RESPONSE',
        bot_response_2: 'EMPTY_RESPONSE',
        bot_response_3: 'EMPTY_RESPONSE'
      });
    }

    // ── Pause check: bot silent if within 24h cooldown ───────────
    const paused = await isBotPaused(contact_id);
    if (paused) {
      console.log(`⏸️  Bot paused for ${contact_id} — skipping response`);
      return res.json({
        bot_response: 'EMPTY_RESPONSE',
        bot_response_2: 'EMPTY_RESPONSE',
        bot_response_3: 'EMPTY_RESPONSE'
      });
    }

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

      const bookingIntent = await detectBookingIntent(user_message, history);
      console.log(`📌 Booking intent:`, JSON.stringify(bookingIntent));

      const askedPrefAlready = hasAskedBookingPreference(history);

      // ── CASE A: Customer says they'll book themselves ─────────────
      if (bookingIntent.isSelfBooking || (askedPrefAlready && !bookingIntent.isAssistedBooking && bookingIntent.isBooking === false)) {
        const thankYou = {
          de: returning
            ? `Super, danke dir! 😊 Wenn du Fragen hast, meld dich einfach. Bis bald! 💅`
            : `Super, danke! 😊 Falls du Fragen hast, sind wir gerne für dich da. Bis bald! 💅`,
          en: returning
            ? `Awesome, thanks! 😊 Give us a shout if you need anything. See you soon! 💅`
            : `Great, thank you! 😊 Feel free to reach out if you have any questions. See you soon! 💅`,
          vi: returning
            ? `Tuyệt vời, cảm ơn bạn nhé! 😊 Có gì cứ nhắn mình. Hẹn gặp bạn sớm! 💅`
            : `Cảm ơn bạn! 😊 Nếu có thắc mắc gì cứ nhắn mình nhé. Hẹn gặp bạn! 💅`
        };
        botResponse = thankYou[userLang] || thankYou.de;
        console.log('📤 Self-booking thank you sent');

      // ── CASE B: Customer explicitly asks us to book for them ──────
      } else if (bookingIntent.isAssistedBooking) {
        const validationB = validateBookingDatetime(bookingIntent.datetime);
        if (!validationB.valid) {
          botResponse = buildInvalidDatetimeReply(validationB.reason, userLang, returning);
          console.log(`📤 CASE B: invalid datetime (${validationB.reason}), asking to pick again`);
        } else {
        await saveBookingToSummary(contact_id, user_name, bookingIntent);
        const assisted = {
          de: returning
            ? `Klar, ich kümmere mich darum! 😊 Ich habe deinen Terminwunsch${bookingIntent.datetime ? ' für ' + bookingIntent.datetime : ''} notiert. Unser Team prüft den Kalender und meldet sich gleich bei dir. Danke! 💅`
            : `Alles klar! Ich habe Ihren Terminwunsch${bookingIntent.datetime ? ' für ' + bookingIntent.datetime : ''} notiert. Unser Team prüft den Kalender und meldet sich in Kürze bei Ihnen. Vielen Dank! 💅`,
          en: returning
            ? `Of course, I'll sort that for you! 😊 I've noted your request${bookingIntent.datetime ? ' for ' + bookingIntent.datetime : ''}. Our team will check the calendar and get back to you shortly. Thanks! 💅`
            : `Sure thing! I've noted your appointment request${bookingIntent.datetime ? ' for ' + bookingIntent.datetime : ''}. Our team will check the calendar and get back to you soon. Thank you! 💅`,
          vi: returning
            ? `Được rồi, mình lo cho bạn nhé! 😊 Mình đã ghi nhận lịch${bookingIntent.datetime ? ' ' + bookingIntent.datetime : ''} cho bạn. Nhân viên sẽ kiểm tra lịch và phản hồi sớm. Cảm ơn bạn! 💅`
            : `Được ạ! Mình đã ghi nhận yêu cầu đặt lịch${bookingIntent.datetime ? ' ' + bookingIntent.datetime : ''} của bạn. Nhân viên sẽ kiểm tra lịch và phản hồi lại bạn sớm nhé. Cảm ơn bạn! 💅`
        };
        botResponse = assisted[userLang] || assisted.de;
        console.log('📤 Assisted booking confirmed, summary saved');
        } // end validationB.valid

      // ── CASE C: Customer wants to book ───────────────────────────
      } else if (bookingIntent.isBooking && !askedPrefAlready) {
        const BOOKING_LINK = 'https://nailounge101.setmore.com/';

        if (bookingIntent.datetime) {
          // C1: Customer gave date/time → validate, then confirm + save + thank
          const validationC1 = validateBookingDatetime(bookingIntent.datetime);
          if (!validationC1.valid) {
            botResponse = buildInvalidDatetimeReply(validationC1.reason, userLang, returning);
            console.log(`📤 CASE C1: invalid datetime (${validationC1.reason}), asking to pick again`);
          } else {
          await saveBookingToSummary(contact_id, user_name, bookingIntent);
          const confirmC1 = {
            de: returning
              ? `Super, ${bookingIntent.datetime} ist notiert! 😊 Das Team schaut in den Kalender und meldet sich bei dir. Danke! 💅`
              : `Alles klar! ${bookingIntent.datetime} habe ich notiert. Das Team prüft den Kalender und meldet sich in Kürze bei Ihnen. Vielen Dank! 💅`,
            en: returning
              ? `Got it, ${bookingIntent.datetime} is noted! 😊 The team will check the calendar and get back to you. Thanks! 💅`
              : `Perfect! I've noted ${bookingIntent.datetime}. Our team will check the calendar and get back to you shortly. Thank you! 💅`,
            vi: returning
              ? `Oke, mình đã ghi nhận ${bookingIntent.datetime} rồi! 😊 Nhân viên sẽ check lịch và phản hồi lại bạn nhé. Cảm ơn bạn! 💅`
              : `Được ạ! Mình đã ghi nhận ${bookingIntent.datetime}. Nhân viên sẽ kiểm tra lịch và phản hồi lại bạn sớm. Cảm ơn bạn! 💅`
          };
          botResponse = confirmC1[userLang] || confirmC1.de;
          console.log('📤 CASE C1: datetime given → confirmed + saved, no link');
          } // end validationC1.valid

        } else {
          // C2: No date/time yet → send link + ask if they want us to book for them
          const askC2 = {
            de: returning
              ? `Hey! 😊 Du kannst direkt über unseren Link buchen – das geht am schnellsten:
${BOOKING_LINK}

Oder sag mir einfach wann du kommen möchtest und ich merke es für dich vor!`
              : `Hallo! 😊 Sie können direkt über unseren Link buchen:
${BOOKING_LINK}

Oder teilen Sie uns Ihren Wunschtermin mit – sollen wir ihn für Sie vormerken?`,
            en: returning
              ? `Hey! 😊 You can book directly via our link – quickest way:
${BOOKING_LINK}

Or just tell me when you'd like to come and I'll note it down for you!`
              : `Hello! 😊 You can book directly via our link:
${BOOKING_LINK}

Or let us know your preferred date and time – would you like us to book it for you?`,
            vi: returning
              ? `Hey! 😊 Bạn có thể tự đặt lịch qua link này cho nhanh:
${BOOKING_LINK}

Hoặc cho mình biết ngày giờ bạn muốn đến, mình đặt giùm cho nhé!`
              : `Xin chào! 😊 Bạn có thể đặt lịch trực tiếp qua link:
${BOOKING_LINK}

Hoặc cho chúng mình biết ngày giờ bạn muốn, bạn có muốn mình đặt giùm không?`
          };
          botResponse = askC2[userLang] || askC2.de;
          console.log('📤 CASE C2: no datetime, sending link + asking if assisted');
        }

      // ── CASE D: Regular conversation ──────────────────────────────
      } else {
        botResponse = await generateAIResponse(user_message, history, userLang, 'NORMAL', returning);
        console.log('📤 Normal AI response');
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
