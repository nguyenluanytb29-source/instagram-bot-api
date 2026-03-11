// server.js - FINAL COMPLETE VERSION
// v4: New Modellkunde message + Staff takeover (24h pause)
// v5: AI intent classification + Multi-language + Smart booking + Time accuracy

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

🌍 SPRACHE (KRITISCH - OBERSTE PRIORITÄT!):
‼️ ANTWORTE IMMER IN DER SPRACHE DER AKTUELLEN NACHRICHT ‼️

SPRACHERKENNUNG:
- "chủ nhật", "ngày mai", "tôi muốn", "được không" = VIETNAMESISCH → Antworte auf VIETNAMESISCH
- "hello", "hi", "tomorrow", "I want", "can I" = ENGLISCH → Antworte auf ENGLISCH  
- "Guten Tag", "ich möchte", "morgen", "Termin" = DEUTSCH → Antworte auf DEUTSCH

🔴 NIEMALS Sprache wechseln basierend auf Chat History!
🔴 Jede neue Nachricht kann eine andere Sprache sein!
🔴 "chủ nhật 17h" ist VIETNAMESISCH → Antworte NUR auf VIETNAMESISCH!

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
→ NUR DANN: Begrüße in der Sprache des Kunden
  - Deutsch: "Guten Tag! Willkommen bei Nailounge101 Berlin. Wie kann ich helfen, bitte?"
  - Englisch: "Hello! Welcome to Nailounge101 Berlin. How can I help you?"
  - Vietnamesisch: "Xin chào! Chào mừng đến Nailounge101 Berlin. Tôi có thể giúp gì?"

MODELLKUNDEN - TERMIN BUCHEN:
Wenn MODELLKUNDE "ja" oder "in Ordnung" oder "ok" antwortet (= akzeptiert die Bedingungen):
→ Gib den Buchungslink in der Sprache des Kunden:
  - Deutsch: "Perfekt! Bitte buchen Sie hier: [LINK]"
  - Englisch: "Perfect! Please book here: [LINK]"
  - Vietnamesisch: "Hoàn hảo! Vui lòng đặt lịch tại đây: [LINK]"
→ Link: https://nailounge101.setmore.com/book?step=time-slot&products=d8f1cdd3-ca6f-42b7-8f2a-fbbb64cbcd2d&type=service&staff=jeeZoVSakEm9KfPuHaC7ZwfaPN9CKI1R&staffSelected=true

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

🔗 TERMIN-ANFRAGE - ZWEI FÄLLE:

FALL A: Kunde nennt DIREKT Tag + Uhrzeit in erster Nachricht
Beispiele: "Ich möchte morgen um 15h", "Can I book tomorrow 3pm", "Tôi muốn đặt ngày mai 3h chiều"
→ KEIN Link senden
→ Antworte: "Perfekt! Unsere Mitarbeiter prüfen die Verfügbarkeit und melden sich. Vielen Dank!" (in Kundensprache)

FALL B: Kunde fragt OHNE spezifische Zeit
Beispiele: "Ich möchte einen Termin", "Can I book?", "Tôi muốn đặt lịch"
→ Sende Setmore Link:
  - Deutsch: "Gerne! Online: https://nailounge101.setmore.com/ Oder sagen Sie Tag und Uhrzeit, dann helfe ich gerne!"
  - Englisch: "Sure! Online: https://nailounge101.setmore.com/ Or tell me day and time, I'll help!"
  - Vietnamesisch: "Được! Đặt online: https://nailounge101.setmore.com/ Hoặc cho biết ngày giờ, tôi sẽ hỗ trợ!"

⚠️ AUSNAHME - MODELLKUNDEN:
Wenn Kunde ein MODELLKUNDE ist (hat schon die Modell-Info bekommen):
→ KEIN normales Setmore Link geben
→ Nur nach Akzeptanz den speziellen Modellkunden-Link geben (siehe oben)

⚠️ KRITISCH:
- NORMALE KUNDEN: IMMER Link geben (außer Fall A mit direkter Zeit)
- MODELLKUNDEN: Nur speziellen Link nach Akzeptanz
- NICHT nur fragen: "Welcher Tag passt Ihnen?" bei NORMALEN Kunden ohne direkter Zeit (Link vergessen!)

⏰ ÖFFNUNGSZEITEN:
Montag - Freitag: 09:30 - 19:00 Uhr
Samstag: 09:30 - 16:00 Uhr
Sonntag: Geschlossen

🕐 ZEIT-FORMATE (WICHTIG - IMMER 24H FORMAT VERWENDEN!):
- "3h" oder "3pm" oder "3h chiều" = 15:00 (15h im 24h-Format)
- "6h" oder "6pm" oder "6h tối" = 18:00 (18h im 24h-Format)
- "3h" ohne "chiều/pm" könnte 03:00 oder 15:00 sein - IMMER nachfragen welche!
- Speichere Zeit IMMER in 24h-Format: 14:00, 15:00, 18:00 etc.
- NIEMALS die Zeit von 18h auf 14h oder umgekehrt ändern!

📋 BUCHUNGS-ABLAUF:

⚠️ WICHTIG - VERGANGENE TERMINE:
Wenn ein Termin in der KUNDENZUSAMMENFASSUNG oder Chat History erwähnt wird:
1. Prüfe das AKTUELLE DATUM (siehe oben)
2. Wenn der Termin VOR dem heutigen Datum liegt → Termin ist VORBEI
3. Frage in Kundensprache: "Ihr Termin am [Datum] ist vorbei. Neuer Termin?"

SCHRITT 1 - Termin-Anfrage MIT Zeit:
User: "Morgen 15h" / "Tomorrow 3pm" / "Ngày mai 3h chiều"
→ "Perfekt! Mitarbeiter prüfen Verfügbarkeit. Vielen Dank!" (in Kundensprache)
→ KEIN Link!

SCHRITT 2 - Termin-Anfrage OHNE Zeit:
User: "Ich möchte Termin" / "I want appointment" / "Tôi muốn đặt lịch"
→ Link + manuelle Option (in Kundensprache)

SCHRITT 3 - Kunde nennt NUR Tag:
User: "Montag" / "Monday" / "Thứ hai"
→ Frage nach Uhrzeit (in Kundensprache)

SCHRITT 4 - Kunde nennt Uhrzeit:

📋 ÖFFNUNGSZEITEN-CHECK:

🔴 SCHRITT 0 - DATUM PRÜFEN (IMMER ZUERST!):
Wenn Datum VOR heute → "Entschuldigung, [Datum] ist vorbei. Welches Datum ab heute?" (in Kundensprache)

A) MONTAG - FREITAG (09:30 - 19:00):
✅ Innerhalb:
  - Deutsch: "Perfekt! Mitarbeiter prüfen die Verfügbarkeit. Vielen Dank!"
  - English: "Perfect! Staff will check availability. Thank you!"
  - Vietnamese: "Được! Nhân viên sẽ kiểm tra lịch. Cảm ơn!"
❌ Außerhalb:
  - Deutsch: "Entschuldigung, Mo-Fr 09:30-19:00. Welche Uhrzeit zwischen 09:30-19:00?"
  - English: "Sorry, Mon-Fri 09:30-19:00. What time between 09:30-19:00?"
  - Vietnamese: "Xin lỗi, Thứ hai-Thứ sáu 09:30-19:00. Giờ nào từ 09:30-19:00?"

⚠️ WICHTIG: 18h = OK (vor 19:00), 19h = NICHT OK (ab 19:00 geschlossen)

B) SAMSTAG (09:30 - 16:00):
✅ Innerhalb:
  - Deutsch: "Perfekt! Mitarbeiter prüfen die Verfügbarkeit. Vielen Dank!"
  - English: "Perfect! Staff will check availability. Thank you!"
  - Vietnamese: "Được! Nhân viên sẽ kiểm tra lịch. Cảm ơn!"
❌ Außerhalb:
  - Deutsch: "Entschuldigung, samstags 09:30-16:00. Welche Uhrzeit zwischen 09:30-16:00?"
  - English: "Sorry, Saturday 09:30-16:00. What time between 09:30-16:00?"
  - Vietnamese: "Xin lỗi, Thứ bảy 09:30-16:00. Giờ nào từ 09:30-16:00?"

⚠️ WICHTIG: 15h = OK, 15:30 = OK, 16h = NICHT OK (ab 16:00 geschlossen)

C) SONNTAG (GESCHLOSSEN):
  - Deutsch: "Entschuldigung, sonntags geschlossen. Möchten Sie einen Termin von Montag bis Samstag?"
  - English: "Sorry, closed on Sunday. Would you like to book Monday to Saturday?"
  - Vietnamese: "Xin lỗi, chủ nhật đóng cửa. Bạn muốn đặt lịch từ thứ hai đến thứ bảy không?"

🔴 KRITISCHES BEISPIEL:
User: "chủ nhật 17h" (VIETNAMESISCH!)
Bot: "Xin lỗi, chủ nhật đóng cửa. Bạn muốn đặt lịch từ thứ hai đến thứ bảy không?"
NICHT: "Entschuldigung, Sonntag..." (FALSCH! User schreibt Vietnamesisch!)

D) WENN TAG NICHT GENANNT:
User sagt nur Uhrzeit ohne Tag (z.B. "14h" ohne Tag davor):
→ Annehmen es ist Mo-Fr
→ Check gegen 09:30-19:00

GRUNDREGELN:
- Antworte IMMER in der Sprache des Kunden
- Maximal 2-3 Sätze
- Höflich und professionell
- Zeit IMMER in 24h-Format speichern und verwenden

PREISE:
Maniküre: ohne 15€, Nagellack 25€, Shellac 35€
Neumodellage: Natur 30€, Farbe 35€, French 38€, Ombre 38€
Pediküre: Basic ohne 28€, Advanced ohne 33€, Luxus ohne 38€
Reparatur: Nagel 5€, Ablösen 10-20€

WICHTIG:
- Prüfe ob [assistant] in History ist
- Wenn JA → KEIN Gruß
- Beziehe dich auf Chat History
- Keine Wiederholungen
- Zeit NIEMALS ändern (18h bleibt 18h!)`;

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

const MODELL_MESSAGE_EN = `Hello!
We are delighted that you are interested in our services.
We are currently accepting customers for our students.
The price for nails depends on the design:
If you want natural clear, the price is 15 €.
If you want natural makeup, French, color, glitter, ombre or cat eye, it costs 20 €.
For more elaborate designs we charge an additional 1 € per design nail,
and each rhinestone costs 0.50 €.
However, our students may not be able to implement very complicated patterns.
The treatment time is usually about 2 to 3 hours,
and the result may not be perfect — we want to inform you in advance so you know.
We also offer touch-ups within 3 days.
Is that okay with you? 💅`;

const MODELL_MESSAGE_VI = `Xin chào!
Chúng tôi rất vui vì bạn quan tâm đến dịch vụ của chúng tôi.
Hiện tại chúng tôi đang nhận khách cho học viên của mình.
Giá làm móng phụ thuộc vào thiết kế:
Nếu bạn muốn tự nhiên trong suốt, giá là 15 €.
Nếu bạn muốn tự nhiên makeup, French, màu, glitter, ombre hoặc mắt mèo, giá là 20 €.
Đối với thiết kế phức tạp hơn, chúng tôi tính thêm 1 € cho mỗi móng thiết kế,
và mỗi viên đá giá 0,50 €.
Tuy nhiên, học viên của chúng tôi có thể không thực hiện được những mẫu quá phức tạp.
Thời gian thực hiện thường khoảng 2 đến 3 giờ,
và kết quả có thể không hoàn hảo — chúng tôi muốn thông báo trước để bạn biết.
Chúng tôi cũng cung cấp dịch vụ chỉnh sửa trong vòng 3 ngày.
Bạn đồng ý chứ? 💅`;

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

async function classifyCustomerIntent(userMessage, history) {
  try {
    const historyContext = history.slice(-5).map(msg => 
      `[${msg.role}]: ${msg.message}`
    ).join('\n');

    const classification = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Intent-Classifier für ein Nagelstudio.
Analysiere die GESAMTE Nachricht und den Kontext, nicht nur einzelne Keywords.

Klassifiziere als "MODELLKUNDE" wenn:
- Inhalt handelt von Schülern/Azubis/Training/Übung/15 Euro
- ODER Nachricht fragt nach günstigen Preisen/Anfänger-Service
- AUCH OHNE direkte Keywords, wenn der Gesamtkontext darauf hindeutet

Klassifiziere als "NORMAL" wenn:
- Normale Terminanfrage
- Frage nach regulären Services/Preisen
- Kein Bezug zu Schülern/Training

Antworte NUR mit: MODELLKUNDE oder NORMAL`
        },
        {
          role: 'user',
          content: `Kontext:\n${historyContext}\n\nAktuelle Nachricht: ${userMessage}\n\nKlassifikation?`
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    const intent = classification.choices[0].message.content.trim().toUpperCase();
    console.log(`🎯 Intent classification: ${intent}`);
    return intent === 'MODELLKUNDE';
  } catch (error) {
    console.error('❌ Intent classification error:', error);
    return hasModellKeyword(userMessage);
  }
}

async function detectLanguageWithAI(userMessage, conversationHistory) {
  try {
    // For very first message with clear patterns, use fast detection
    const lower = userMessage.toLowerCase().trim();
    if (conversationHistory.length === 0) {
      if (['hello', 'hi', 'hey'].some(g => lower === g || lower.startsWith(g + ' '))) return 'en';
      if (['guten tag', 'hallo'].some(g => lower.includes(g))) return 'de';
      if (['xin chào', 'chào'].some(g => lower.includes(g))) return 'vi';
    }
    
    // Build conversation context ONLY from USER messages (not bot responses)
    const recentUserMessages = conversationHistory
      .filter(msg => msg.role === 'user')  // ONLY user messages
      .slice(-5)
      .map(msg => msg.message)
      .join('\n');
    
    const context = recentUserMessages 
      ? `Previous customer messages:\n${recentUserMessages}\n\nCurrent customer message: ${userMessage}`
      : `Current customer message: ${userMessage}`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a language detector. Analyze ONLY the customer's messages to determine what language they are using.

CRITICAL RULES:
1. Look ONLY at the customer's messages, IGNORE bot responses
2. Determine the language the CUSTOMER has been consistently using
3. If customer wrote "I want appointment Sunday 5pm" → ENGLISH
4. If customer then writes "ja ok Saturday 2pm" → Still ENGLISH (customer's language)
5. "ja" is just a filler word, the sentence structure is English
6. Focus on the dominant language in the customer's message history

Respond with ONLY ONE WORD:
- "vietnamese" if the customer is using Vietnamese
- "english" if the customer is using English  
- "german" if the customer is using German

DO NOT include any explanation. Just the language name.`
        },
        {
          role: 'user',
          content: context
        }
      ],
      temperature: 0,
      max_tokens: 10
    });
    
    const detected = completion.choices[0].message.content.trim().toLowerCase();
    console.log(`🤖 AI language detection: ${detected}`);
    console.log(`📝 Context analyzed: ${context.substring(0, 200)}...`);
    
    if (detected.includes('vietnamese') || detected.includes('vi')) return 'vi';
    if (detected.includes('english') || detected.includes('en')) return 'en';
    if (detected.includes('german') || detected.includes('de')) return 'de';
    
    // Fallback to keyword detection
    return detectLanguage(userMessage);
  } catch (error) {
    console.error('❌ AI language detection error:', error);
    return detectLanguage(userMessage);
  }
}

function detectLanguage(text) {
  const lower = text.toLowerCase().trim();
  
  // Direct English greetings - highest priority
  const englishGreetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
  if (englishGreetings.some(g => lower === g || lower.startsWith(g + ' '))) {
    return 'en';
  }
  
  // Direct German greetings
  const germanGreetings = ['guten tag', 'hallo', 'guten morgen', 'guten abend', 'servus', 'moin'];
  if (germanGreetings.some(g => lower === g || lower.startsWith(g + ' '))) {
    return 'de';
  }
  
  // Direct Vietnamese greetings
  const vietnameseGreetings = ['xin chào', 'chào', 'chào bạn'];
  if (vietnameseGreetings.some(g => lower === g || lower.startsWith(g + ' '))) {
    return 'vi';
  }
  
  // Vietnamese day names - high priority
  const vietnameseDays = ['chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy', 'thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7'];
  if (vietnameseDays.some(d => lower.includes(d))) {
    return 'vi';
  }
  
  // Pattern matching for longer messages
  const viPatterns = ['tôi', 'bạn', 'được', 'không', 'muốn', 'cần', 'ngày', 'giờ', 'làm', 'đặt', 'ạ', 'ơi', 'nhé'];
  const viCount = viPatterns.filter(p => lower.includes(p)).length;
  
  const enPatterns = ['i', 'you', 'can', 'want', 'need', 'appointment', 'book', 'tomorrow', 'today', 'please', 'thank', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const enCount = enPatterns.filter(p => new RegExp(`\\b${p}\\b`).test(lower)).length;
  
  const dePatterns = ['ich', 'sie', 'möchte', 'brauche', 'termin', 'buchen', 'morgen', 'heute', 'bitte', 'danke', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];
  const deCount = dePatterns.filter(p => new RegExp(`\\b${p}\\b`).test(lower)).length;
  
  // Lower threshold for Vietnamese since it has unique characters
  if (viCount >= 1) return 'vi';
  if (enCount >= 1) return 'en';
  if (deCount >= 1) return 'de';
  
  // Default to English (not German) for ambiguous cases
  return 'en';
}

async function isModellkundeConversation(userMessage, history) {
  const isModell = await classifyCustomerIntent(userMessage, history);
  
  if (!isModell) {
    console.log('✗ Not a Modellkunde intent');
    return false;
  }
  
  console.log('✓ Modellkunde intent detected');
  
  if (history && history.length > 0) {
    const alreadySentModellInfo = history.some(msg => 
      msg.role === 'assistant' && 
      (msg.message.includes('Wir freuen uns sehr') || 
       msg.message.includes('We are delighted') ||
       msg.message.includes('Chúng tôi rất vui'))
    );
    
    if (alreadySentModellInfo) {
      console.log('✗ Modell info already sent - NOT sending again');
      return false;
    }
  }
  
  console.log('✓ First time Modell - WILL send info');
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
      (msg.message.includes('Guten Tag') || msg.message.includes('Willkommen') ||
       msg.message.includes('Hello') || msg.message.includes('Welcome') ||
       msg.message.includes('Xin chào') || msg.message.includes('Chào mừng'))
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
    
    // Use AI to detect language based on entire conversation context
    const userLang = await detectLanguageWithAI(user_message, history);
    console.log(`🌍 AI-detected language: ${userLang} (message: "${user_message}")`);

    const languageMap = {
      'vi': 'VIETNAMESE (Tiếng Việt)',
      'en': 'ENGLISH',
      'de': 'GERMAN (Deutsch)'
    };
    const detectedLangName = languageMap[userLang] || 'ENGLISH';
    
    const userContent = shouldSkipGreeting
      ? `${dateContext}${summaryContext}
Chat history (last 50 messages):
${historyText}

---

CURRENT MESSAGE: ${user_message}

---

🔴🔴🔴 CRITICAL LANGUAGE INSTRUCTION 🔴🔴🔴
THE CUSTOMER HAS BEEN WRITING IN: ${detectedLangName}
YOU MUST CONTINUE RESPONDING IN: ${detectedLangName}

⚠️ IMPORTANT RULE:
- If the conversation history shows the customer has been using Vietnamese → KEEP using Vietnamese
- If the conversation history shows the customer has been using English → KEEP using English
- If the conversation history shows the customer has been using German → KEEP using German
- DO NOT switch languages mid-conversation!

Examples:
- History shows Vietnamese → Customer says "ok vậy 14h" → Respond in VIETNAMESE (not English!)
- History shows English → Customer says "ok dann 14h" → Respond in ENGLISH (not German!)
- History shows German → Customer says "ok 14h" → Respond in GERMAN (not English!)

⚠️ IMPORTANT: You have ALREADY greeted this customer before (see history or summary above).
DO NOT greet again.
${isReturningCustomer && !hasGreeted ? '⚠️ This is a RETURNING CUSTOMER from a previous day. Continue naturally based on the summary above.' : ''}
Answer the question DIRECTLY in ${detectedLangName}.`
      : `${dateContext}${summaryContext}
Chat history (last 50 messages):
${historyText}

---

CURRENT MESSAGE: ${user_message}

---

🔴🔴🔴 CRITICAL LANGUAGE INSTRUCTION 🔴🔴🔴
THE CUSTOMER IS WRITING IN: ${detectedLangName}
YOU MUST RESPOND IN: ${detectedLangName}

This is a ${history.length === 0 ? 'NEW' : 'CONTINUING'} conversation.
Greet and answer in ${detectedLangName}.`;

    console.log(`🔍 DEBUG - User message: "${user_message}"`);
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
    
    const shouldSendModellInfo = await isModellkundeConversation(user_message, history);

    console.log(`🔍 DEBUG - shouldSendModellInfo: ${shouldSendModellInfo}`);
    
    if (shouldSendModellInfo) {
      console.log('🔍 Sending Modell info');
      
      const alreadyGreeted = history.some(msg => 
        msg.role === 'assistant'
      );
      
      let modellMessage;
      if (userLang === 'vi') {
        modellMessage = alreadyGreeted ? MODELL_MESSAGE_VI.replace('Xin chào!\n', '') : MODELL_MESSAGE_VI;
      } else if (userLang === 'en') {
        modellMessage = alreadyGreeted ? MODELL_MESSAGE_EN.replace('Hello!\n', '') : MODELL_MESSAGE_EN;
      } else {
        modellMessage = alreadyGreeted ? MODELL_MESSAGE.replace('Guten Tag!\n', '') : MODELL_MESSAGE;
      }
      
      console.log(`📝 Modell message (${userLang}) ${alreadyGreeted ? 'WITHOUT' : 'WITH'} greeting`);
      
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
