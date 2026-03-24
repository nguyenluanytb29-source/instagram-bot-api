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

🔗 TERMIN-ANFRAGE - ZWEI FÄLLE (NUR FÜR NORMALE KUNDEN):

🔴 FALL A: Kunde nennt DIREKT Tag + Uhrzeit
Beispiele: 
- "Ich möchte morgen um 15h"
- "Can I book tomorrow 3pm"
- "Tôi muốn đặt ngày mai 3h chiều"
- "Saturday 2pm"
- "thứ bảy 14h"

→ KEIN LINK SENDEN! ❌ https://nailounge101.setmore.com/
→ Antworte: "Perfekt! Unsere Mitarbeiter prüfen die Verfügbarkeit und melden sich. Vielen Dank!" (in Kundensprache)

WARUM KEIN LINK?
- Kunde hat schon Tag + Uhrzeit genannt
- Mitarbeiter werden manuell prüfen
- Link ist für Selbstbuchung OHNE spezifische Zeit

✅ RICHTIGE ANTWORTEN (Fall A):
- Vietnamese: "Được! Nhân viên sẽ kiểm tra lịch và liên hệ lại sớm. Cảm ơn!"
- English: "Perfect! Our staff will check availability and get back to you. Thank you!"
- German: "Perfekt! Unsere Mitarbeiter prüfen die Verfügbarkeit und melden sich. Vielen Dank!"

❌ FALSCHE ANTWORTEN (Fall A):
- "Bitte buchen Sie hier: https://nailounge101.setmore.com/" ← FALSCH! Kein Link!
- "Please book here: https://nailounge101.setmore.com/" ← FALSCH! Kein Link!

---

🔴 FALL B: Kunde fragt OHNE spezifische Zeit
Beispiele: 
- "Ich möchte einen Termin"
- "Can I book?"
- "Tôi muốn đặt lịch"
- "bảng giá khách thường" (nur Preis, keine Buchung)

→ Sende Setmore Link + manuelle Option:
  - Deutsch: "Gerne! Online: https://nailounge101.setmore.com/ Oder sagen Sie Tag und Uhrzeit, dann helfe ich gerne!"
  - Englisch: "Sure! Online: https://nailounge101.setmore.com/ Or tell me day and time, I'll help!"
  - Vietnamesisch: "Được! Đặt online: https://nailounge101.setmore.com/ Hoặc cho biết ngày giờ, tôi sẽ hỗ trợ!"

⚠️ KRITISCH - UNTERSCHIED MODELL vs NORMAL:
- MODELLKUNDEN: Immer Link senden (auch wenn Tag+Zeit genannt) → https://nailounge101.setmore.com/team/...
- NORMALE KUNDEN: Wenn Tag+Zeit → KEIN Link, nur "Mitarbeiter prüfen"

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
- "4h chiều" = 16:00 (4pm afternoon)
- "6h" oder "6pm" oder "6h tối" = 18:00 (18h im 24h-Format)
- "3h" ohne "chiều/pm" könnte 03:00 oder 15:00 sein - IMMER nachfragen welche!
- Speichere Zeit IMMER in 24h-Format: 14:00, 15:00, 16:00, 18:00 etc.
- NIEMALS die Zeit von 18h auf 14h oder umgekehrt ändern!

⚠️ VIETNAMESE TIME CONVERSIONS:
- "2h chiều" = 14:00 (2pm)
- "3h chiều" = 15:00 (3pm)
- "4h chiều" = 16:00 (4pm) ← CRITICAL!
- "5h chiều" = 17:00 (5pm)
- "6h tối" = 18:00 (6pm)
- "chiều" = afternoon (12:00-18:00)
- "tối" = evening (18:00-22:00)

📋 BUCHUNGS-ABLAUF:

⚠️ CRITICAL - COMBINING DAY + TIME FROM CONVERSATION:
If the customer mentions ONLY TIME (e.g., "2h chiều", "14h", "3pm") in current message,
BUT conversation history shows they ALREADY mentioned a DAY (e.g., "thứ 7", "Saturday", "Samstag"):
→ COMBINE THEM! Customer has given BOTH day + time!
→ Respond: "Được! Nhân viên sẽ kiểm tra lịch và liên hệ lại sớm. Cảm ơn!"
→ NO LINK! Staff will check manually!

Examples:
History: Bot asked "Bạn muốn giờ nào vào thứ bảy?"
Current: User says "2h chiều"
→ Customer has BOTH: thứ 7 (Saturday) + 2h chiều (14:00)
→ Response: "Được! Nhân viên sẽ kiểm tra lịch và liên hệ lại sớm. Cảm ơn!"

History: User said "ok vậy thứ 7 đi"
Current: User says "14h"
→ Customer has BOTH: thứ 7 + 14h
→ Response: "Được! Nhân viên sẽ kiểm tra lịch và liên hệ lại sớm. Cảm ơn!"

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

const MODELL_MESSAGE = `Guten Tag! 😊
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

Wäre das für Sie in Ordnung? 💅

Wenn alles für Sie passt, können wir gerne einen Termin vereinbaren.`;

const MODELL_MESSAGE_EN = `Hello! 😊
Thank you for your interest in our services.
We are currently looking for models for our students.

The price depends on the design:
• Natural (clear): 15 €
• Natural makeup, French, color, glitter, ombre or cat-eye: 20 €

For more elaborate designs, we charge additionally:
• 1 € per design nail
• 0.50 € per rhinestone

Please note:
Since the treatment is performed by a student, very complicated designs may not be possible.

The treatment time is usually about 2–3 hours.
The result may not be perfect as this is practice – we want to inform you in advance.

If something is not satisfactory, we offer a free touch-up within 3 days.

Would that be okay with you? 💅

If everything is suitable for you, we would be happy to arrange an appointment.`;

const MODELL_MESSAGE_VI = `Xin chào! 😊
Cảm ơn bạn đã quan tâm đến dịch vụ của chúng tôi.
Hiện tại chúng tôi đang tìm khách mẫu cho học viên.

Giá phụ thuộc vào thiết kế:
• Tự nhiên (trong suốt): 15 €
• Tự nhiên makeup, French, màu, glitter, ombre hoặc mắt mèo: 20 €

Đối với thiết kế phức tạp hơn, chúng tôi tính thêm:
• 1 € cho mỗi móng thiết kế
• 0,50 € cho mỗi viên đá

Lưu ý:
Do học viên thực hiện, các thiết kế quá phức tạp có thể không thực hiện được.

Thời gian thực hiện thường khoảng 2–3 giờ.
Kết quả có thể không hoàn hảo vì đây là buổi thực hành – chúng tôi muốn thông báo trước.

Nếu có gì chưa hài lòng, chúng tôi cung cấp dịch vụ sửa miễn phí trong vòng 3 ngày.

Bạn đồng ý chứ? 💅

Nếu mọi thứ phù hợp với bạn, chúng tôi rất vui được sắp xếp lịch hẹn.`;

const MODELL_BOOKING_MESSAGE = `Super, das freut uns sehr! 😊

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

Wir freuen uns auf Ihren Besuch bei Nailounge101! 💅`;

const MODELL_BOOKING_MESSAGE_EN = `Super, we are very happy! 😊

Since we only have a few model spots available, we recommend booking your appointment directly online.

You can reserve your appointment here:
https://nailounge101.setmore.com/team/jeeZoVSakEm9KfPuHaC7ZwfaPN9CKI1R

Model appointments are exclusively booked online and must be paid in advance to ensure your appointment is reserved for you.

Without advance payment, the appointment cannot be reserved.
Only fully paid appointments will be confirmed.

Please note:
• Appointment booking only possible online.
• Advance payment is required to reserve your appointment.

Cancellation policy:
If you do not show up for the appointment or cancel less than 24 hours in advance, unfortunately no refund is possible.

Model spots are limited and often fill up quickly.

We look forward to your visit at Nailounge101! 💅`;

const MODELL_BOOKING_MESSAGE_VI = `Tuyệt vời, chúng tôi rất vui! 😊

Do chúng tôi chỉ có ít chỗ cho khách mẫu, chúng tôi khuyên bạn nên đặt lịch trực tuyến.

Bạn có thể đặt lịch tại đây:
https://nailounge101.setmore.com/team/jeeZoVSakEm9KfPuHaC7ZwfaPN9CKI1R

Lịch hẹn khách mẫu chỉ được đặt trực tuyến và phải thanh toán trước để đảm bảo lịch hẹn được giữ cho bạn.

Không có thanh toán trước, lịch hẹn không thể được giữ chỗ.
Chỉ các lịch hẹn đã thanh toán đầy đủ mới được xác nhận.

Lưu ý:
• Đặt lịch chỉ có thể thực hiện trực tuyến.
• Thanh toán trước là bắt buộc để giữ chỗ lịch hẹn.

Chính sách hủy:
Nếu bạn không đến hoặc hủy ít hơn 24 giờ trước, rất tiếc chúng tôi không thể hoàn tiền.

Số chỗ cho khách mẫu có hạn và thường nhanh chóng hết chỗ.

Chúng tôi mong được gặp bạn tại Nailounge101! 💅`;

const MODELL_PREPAYMENT_REASON = `Wir bitten um Vorauszahlung, da Modell-Termine sehr lange dauern (ca. 2–3 Stunden) und wir nur wenige Plätze für unsere Schüler haben.

So können wir sicherstellen, dass der Termin wirklich für Sie reserviert ist.

Vielen Dank für Ihr Verständnis! 😊

Leider hatten wir in der Vergangenheit viele Termin-Ausfälle, daher ist die Vorauszahlung für Modell-Termine notwendig.`;

const MODELL_PREPAYMENT_REASON_EN = `We ask for advance payment because model appointments take a very long time (approx. 2–3 hours) and we only have a few spots for our students.

This way we can ensure that the appointment is really reserved for you.

Thank you for your understanding! 😊

Unfortunately, we have had many appointment cancellations in the past, so advance payment for model appointments is necessary.`;

const MODELL_PREPAYMENT_REASON_VI = `Chúng tôi yêu cầu thanh toán trước vì lịch hẹn khách mẫu rất lâu (khoảng 2–3 giờ) và chúng tôi chỉ có ít chỗ cho học viên.

Điều này đảm bảo lịch hẹn thực sự được giữ cho bạn.

Cảm ơn sự thông cảm của bạn! 😊

Rất tiếc, chúng tôi đã có nhiều trường hợp hủy lịch, vì vậy thanh toán trước là cần thiết cho lịch hẹn khách mẫu.`;


function hasModellKeyword(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  const excludePatterns = ['neumodellage', 'neumodelage', 'neuemodellage'];
  if (excludePatterns.some(pattern => lower.includes(pattern))) {
    return false;
  }
  
  const keywords = [
    // Core keywords
    'modell', 'model', 'azubi', 'mẫu', 'học viên', 'khách mẫu',
    // German
    'auszubildende', 'auzubi', 'übung', 'training', 'schulung', 'schüler', 'anfänger', 'lehrling',
    // English
    'trainee', 'student', 'practice', 'beginner', 'apprentice',
    // Vietnamese
    'thực hành', 'luyện tập', 'tập sự',
    // Pricing
    '15euro', '15 euro', '15 €', '15€', 'rẻ', 'günstig', 'cheap'
  ];
  
  // Special Vietnamese patterns
  if (lower.includes('đăng ký') && (lower.includes('mẫu') || lower.includes('học viên'))) {
    return true;
  }
  if (lower.includes('làm khách mẫu') || lower.includes('coi mình là khách')) {
    return true;
  }
  
  return keywords.some(k => lower.includes(k));
}

async function classifyCustomerIntent(userMessage, history) {
  try {
    console.log(`\n🔍 === classifyCustomerIntent START ===`);
    console.log(`  Input message: "${userMessage}"`);
    
    // Quick rejection for obvious non-modell queries  
    const lower = userMessage.toLowerCase().trim();
    console.log(`  Lowercase trimmed: "${lower}"`);
    
    const greetingsOnly = ['xin chào', 'hello', 'hi', 'guten tag', 'hallo', 'chào', 'hey', 'good morning', 'good afternoon'];
    if (greetingsOnly.includes(lower)) {
      console.log('  ✗ Just a greeting, not modellkunde');
      console.log('🔍 === classifyCustomerIntent END: FALSE ===\n');
      return false;
    }
    
    // Quick acceptance for DIRECT modell keywords
    // Use substring match instead of exact match for better detection
    const directModellKeywords = [
      // Core keywords
      'modell', 'model', 'azubi', 'mẫu', 'khách mẫu', 'học viên',
      // German variants
      'auszubildende', 'übung', 'training', 'schulung', 'schüler', 'anfänger', 'lehrling',
      // English variants
      'trainee', 'student', 'practice', 'beginner', 'apprentice',
      // Vietnamese variants
      'thực hành', 'luyện tập', 'tập sự',
      // Pricing (indicates modell interest)
      '15€', '15 euro', '15euro', 'rẻ', 'günstig', 'cheap'
    ];
    
    console.log(`  Checking ${directModellKeywords.length} direct keywords...`);
    
    // Use substring match instead of exact match
    const hasDirectKeyword = directModellKeywords.some(keyword => {
      const matches = lower.includes(keyword);
      if (matches) {
        console.log(`  ✓ MATCH FOUND: "${keyword}" in "${lower}"`);
      }
      return matches;
    });
    
    if (hasDirectKeyword) {
      console.log(`  ✓ Direct modell keyword detected: "${userMessage}" - MODELLKUNDE`);
      console.log('🔍 === classifyCustomerIntent END: TRUE (fast path) ===\n');
      return true;
    }
    
    console.log(`  ✗ No direct keyword match found`);
    console.log(`  → Calling AI for classification...`);
    
    const historyContext = history.slice(-5).map(msg => 
      `[${msg.role}]: ${msg.message}`
    ).join('\n');

    const classification = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Intent-Classifier für ein Nagelstudio.

Klassifiziere als "MODELLKUNDE" NUR wenn der Kunde EXPLIZIT erwähnt:
- "modell" / "model" / "mẫu" / "khách mẫu"
- "azubi" / "auszubildende" / "học viên" / "trainee" / "student"
- "15€" / "15 euro" / "cheap" / "günstig" / "rẻ"
- "training" / "übung" / "practice" / "thực hành" / "luyện tập"
- "đăng ký làm khách" / "làm khách mẫu" / "coi mình là khách"
- "đăng ký" + "mẫu" / "học viên" in same message
- Oder FRAGT EXPLIZIT nach billigeren/Anfänger-Preisen

Klassifiziere als "NORMAL" wenn:
- NUR Begrüßung ("xin chào", "hello", "guten tag") OHNE weitere Info
- Normale Terminanfrage OHNE Modell-Bezug
- Frage nach regulären Services/Preisen
- Kein expliziter Bezug zu Schülern/Training/Modell
- "ok ngày mai 18h" NACH Modell-Info = Kunde akzeptiert → NORMAL (nicht nochmal MODELLKUNDE!)

🔴 KRITISCH:
- "xin chào" allein = NORMAL
- "hello" allein = NORMAL
- "ok ngày mai 18h" nach bereits gesendeter Modell-Info = NORMAL (Customer booking)

Antworte NUR mit: MODELLKUNDE oder NORMAL`
        },
        {
          role: 'user',
          content: `Kontext:\n${historyContext}\n\nAktuelle Nachricht: ${userMessage}\n\nKlassifikation?`
        }
      ],
      max_tokens: 10,
      temperature: 0
    });

    const intent = classification.choices[0].message.content.trim().toUpperCase();
    console.log(`  AI classification result: ${intent}`);
    console.log(`🔍 === classifyCustomerIntent END: ${intent === 'MODELLKUNDE'} (AI) ===\n`);
    return intent === 'MODELLKUNDE';
  } catch (error) {
    console.error('  ❌ Intent classification error:', error);
    console.log(`  → Falling back to hasModellKeyword...`);
    const fallback = hasModellKeyword(userMessage);
    console.log(`  Fallback result: ${fallback}`);
    console.log(`🔍 === classifyCustomerIntent END: ${fallback} (fallback) ===\n`);
    return fallback;
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
          content: `You are a language detector. Analyze ONLY the customer's messages to determine their PRIMARY communication language.

CRITICAL RULES:
1. Look ONLY at the customer's messages, IGNORE bot responses
2. Determine the DOMINANT language the customer has been using
3. Mixed language examples:
   - "ja ok Saturday 2pm" → Look at previous messages
   - If previous: "I want Sunday 5pm" → Customer is using ENGLISH (just borrowed "ja")
   - If previous: "Ich möchte Sonntag" → Customer is using GERMAN
4. Day names matter: "Saturday" = English, "Samstag" = German, "Thứ bảy" = Vietnamese
5. Filler words "ok", "ja", "yes" alone don't determine language
6. Analyze sentence structure and day/time words more than fillers

Respond with ONLY ONE WORD:
- "vietnamese" if the customer is primarily using Vietnamese
- "english" if the customer is primarily using English  
- "german" if the customer is primarily using German

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
    console.log(`📝 Context analyzed (user messages only):\n${context.substring(0, 300)}...`);
    
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

function customerWantsNormalBooking(userMessage) {
  const lower = userMessage.toLowerCase().trim();
  
  const normalKeywords = [
    'khách thường',
    'không phải khách mẫu',
    'không phải modell',
    'normal customer',
    'not model',
    'not modell',
    'regulär',
    'normaler kunde',
    'nicht modell',
    'đặt lịch bình thường',
    'đặt lịch như khách thường'
  ];
  
  return normalKeywords.some(k => lower.includes(k));
}

async function isModellkundeConversation(userMessage, history, customerType) {
  // If customer type is already 'modell', check if we've sent info
  if (customerType === 'modell') {
    // Filter out invalid messages
    const validHistory = history.filter(msg => 
      msg.message && 
      msg.message.trim().length > 0 && 
      msg.message !== '(SYSTEM)' &&
      !msg.message.startsWith('(SYSTEM)')
    );
    
    // Check for ACTUAL modell message content (not AI-generated)
    // Must contain multiple specific phrases from MODELL_MESSAGE
    const alreadySentModellInfo = validHistory.some(msg => {
      if (msg.role !== 'assistant') return false;
      
      const content = msg.message;
      
      // Check for SPECIFIC phrases that ONLY appear in MODELL_MESSAGE
      // Vietnamese version check
      const hasViModellMessage = 
        content.includes('Giá phụ thuộc vào thiết kế') &&
        content.includes('2–3 giờ') &&
        content.includes('kostenlose Nachbesserung') === false; // Not German
      
      // English version check  
      const hasEnModellMessage =
        content.includes('The price depends on the design') &&
        content.includes('2–3 hours') &&
        content.includes('kostenlose Nachbesserung') === false; // Not German
      
      // German version check
      const hasDeModellMessage =
        content.includes('Der Preis richtet sich nach') &&
        content.includes('2–3 Stunden') &&
        content.includes('kostenlose Nachbesserung');
      
      return hasViModellMessage || hasEnModellMessage || hasDeModellMessage;
    });
    
    if (alreadySentModellInfo) {
      console.log('✗ MODELL_MESSAGE already sent (verified) - NOT sending again');
      return false;
    }
    
    console.log('✓ Customer type is MODELL and no MODELL_MESSAGE in history - WILL send info');
    return true;
  }
  
  // If not modell type, don't send modell info
  console.log('✗ Customer type is not MODELL');
  return false;
}

function isModellkundeAcceptanceWithBooking(userMessage, history) {
  // Filter out empty/SYSTEM messages first
  const validHistory = history.filter(msg => 
    msg.message && 
    msg.message.trim().length > 0 && 
    msg.message !== '(SYSTEM)' &&
    !msg.message.startsWith('(SYSTEM)')
  );
  
  // Check if this is a modellkunde customer (already received modell info)
  const hasReceivedModellInfo = validHistory.some(msg => 
    msg.role === 'assistant' && 
    (msg.message.includes('Cảm ơn bạn đã quan tâm') ||  // Vietnamese
     msg.message.includes('Thank you for your interest') ||  // English
     msg.message.includes('Vielen Dank für Ihr Interesse') ||  // German
     msg.message.includes('Wir freuen uns sehr') || 
     msg.message.includes('We are delighted') ||
     msg.message.includes('Chúng tôi rất vui') ||
     msg.message.includes('Giá phụ thuộc vào thiết kế') ||  // Vietnamese pricing
     msg.message.includes('The price depends on the design') ||  // English pricing
     msg.message.includes('Der Preis richtet sich nach'))  // German pricing
  );
  
  if (!hasReceivedModellInfo) {
    console.log('✗ Customer has NOT received modell info yet (or only SYSTEM messages)');
    return false; // Not a modellkunde customer yet
  }
  
  console.log('✓ Customer HAS received modell info');
  
  // For MODELL customers: They book online themselves!
  // We just send link when they accept (say ok/yes/agree)
  // We DON'T ask for datetime - they choose it on Setmore
  const lower = userMessage.toLowerCase().trim();
  
  // Acceptance keywords
  const acceptanceKeywords = ['ok', 'okay', 'ja', 'yes', 'passt', 'agree', 'được', 'vâng', 'fine', 'sure', 'đồng ý', 'alright'];
  
  // Check if message is JUST acceptance (not other questions)
  const isJustAcceptance = acceptanceKeywords.some(k => 
    lower === k || 
    lower.startsWith(k + ' ') ||
    lower.startsWith(k + ',') ||
    lower.startsWith(k + '.')
  );
  
  console.log(`  isJustAcceptance: ${isJustAcceptance}`);
  
  if (isJustAcceptance) {
    console.log('✓ Modellkunde customer accepting → SEND BOOKING LINK (they book online themselves)');
    return true;
  }
  
  console.log('✗ Not a simple acceptance - may have questions');
  return false;
  
  return result;
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
      customer_type VARCHAR(20),
      preferred_language VARCHAR(5),
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  // Add columns if they don't exist (for existing databases)
  const alterTableQuery = `
    DO $$ 
    BEGIN
      BEGIN
        ALTER TABLE conversation_summary ADD COLUMN customer_type VARCHAR(20);
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
      BEGIN
        ALTER TABLE conversation_summary ADD COLUMN preferred_language VARCHAR(5);
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
    END $$;
  `;
  
  try {
    await pool.query(createTableQuery);
    await pool.query(createSummaryTableQuery);
    await pool.query(alterTableQuery);
    console.log('✅ Database initialized with customer_type and preferred_language columns');
  } catch (error) {
    console.error('❌ Database init error:', error);
  }
}

async function getCustomerState(contactId) {
  const query = `
    SELECT customer_type, preferred_language
    FROM conversation_summary
    WHERE contact_id = $1
  `;
  
  try {
    const result = await pool.query(query, [contactId]);
    if (result.rows.length > 0) {
      return {
        customerType: result.rows[0].customer_type,
        preferredLanguage: result.rows[0].preferred_language
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Get customer state error:', error);
    return null;
  }
}

async function updateCustomerState(contactId, userName, customerType, preferredLanguage) {
  const query = `
    INSERT INTO conversation_summary (contact_id, user_name, summary, customer_type, preferred_language, last_updated)
    VALUES ($1, $2, 'New customer', $3, $4, NOW())
    ON CONFLICT (contact_id) 
    DO UPDATE SET 
      customer_type = $3,
      preferred_language = $4,
      last_updated = NOW()
  `;
  
  try {
    await pool.query(query, [contactId, userName, customerType, preferredLanguage]);
    console.log(`✅ Updated customer state: type=${customerType}, lang=${preferredLanguage}`);
  } catch (error) {
    console.error('❌ Update customer state error:', error);
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

⚠️ WICHTIG - DREI ROLLEN IN CONVERSATION:
- [user]: Kunde schreibt
- [assistant]: Bot antwortet
- [staff]: Mitarbeiter antwortet (manuell)

Wenn [staff] Nachrichten vorhanden sind:
→ Das bedeutet ein Mitarbeiter hat übernommen
→ Fasse zusammen was zwischen Kunde und Mitarbeiter besprochen wurde
→ Notiere wichtige Entscheidungen/Zusagen vom Mitarbeiter
→ Aktueller Status basiert auf letzter staff Nachricht

Erstelle eine kompakte Zusammenfassung auf Deutsch, die folgende Infos enthält (wenn vorhanden):
- Was der Kunde gefragt/gewünscht hat
- Welche Dienstleistungen besprochen wurden
- Ob ein Termin vereinbart wurde (Tag, Uhrzeit IN 24H-FORMAT: 14:00, 18:00 etc.)
- Was der Mitarbeiter zugesagt/vereinbart hat (wenn staff Nachrichten vorhanden)
- Ob der Kunde ein Modellkunde ist oder normaler Kunde
- Besondere Wünsche oder Präferenzen
- Aktueller Status (z.B. "wartet auf Bestätigung", "Termin gebucht durch Mitarbeiter", "fragt nach Preis")

WICHTIG: Speichere Uhrzeiten IMMER in 24h-Format und ändere sie NIEMALS!
Maximal 7 Sätze. Nur die wichtigsten Infos.`
        },
        {
          role: 'user',
          content: `${existingSummaryText}

Neueste Gesprächshistorie (kann [user], [assistant], und [staff] Nachrichten enthalten):
${historyText}

Bitte erstelle eine aktualisierte Zusammenfassung.`
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
    
    // Check if staff takeover JUST expired (staff messages exist but >24h ago)
    const staffExpiredCheck = await pool.query(
      `SELECT role, message, timestamp
       FROM chat_history
       WHERE contact_id = $1 AND role = 'staff'
       ORDER BY timestamp DESC
       LIMIT 1`,
      [contact_id]
    );
    
    if (staffExpiredCheck.rows.length > 0) {
      const lastStaffTimestamp = new Date(staffExpiredCheck.rows[0].timestamp);
      const hoursSinceStaff = (new Date() - lastStaffTimestamp) / (1000 * 60 * 60);
      
      // If staff was active recently (24-48h ago), summarize the conversation
      if (hoursSinceStaff >= 24 && hoursSinceStaff <= 48) {
        console.log(`🔄 Staff takeover just expired (${hoursSinceStaff.toFixed(1)}h ago) - will summarize conversation`);
        // Set flag to force summary update at end of this request
        var forceUpdateSummary = true;
      }
    }
    
    const history = await getChatHistory(contact_id);
    const historyText = formatHistory(history);
    
    console.log(`📚 Found ${history.length} previous messages`);
    
    // ========== CUSTOMER STATE MANAGEMENT ==========
    console.log('\n💾 === CUSTOMER STATE MANAGEMENT ===');
    
    // 1. Get saved customer state from DB
    let customerState = await getCustomerState(contact_id);
    let customerType = customerState?.customerType || null;
    let userLang = customerState?.preferredLanguage || null;
    
    console.log(`📖 Saved state from DB: type=${customerType || 'NULL'}, lang=${userLang || 'NULL'}`);
    
    // 1.5 Check if customer wants to RESTART conversation (just greeting)
    const lower = user_message.toLowerCase().trim();
    const isJustGreeting = 
      lower === 'xin chào' || 
      lower === 'hello' || 
      lower === 'hi' ||
      lower === 'hey' ||
      lower === 'guten tag' ||
      lower === 'hallo' ||
      lower === 'chào';
    
    const isRestartRequest =
      lower.includes('bắt đầu lại') ||
      lower.includes('restart') ||
      lower.includes('start over') ||
      lower.includes('von vorne') ||
      lower.includes('từ đầu');
    
    // If just greeting (even in ongoing conversation), reset to normal
    // OR if explicit restart request
    if (isJustGreeting || isRestartRequest) {
      console.log('🔄 GREETING/RESTART detected - treating as fresh normal customer');
      customerType = 'normal';  // Force normal, not NULL
      
      // Also detect language from greeting
      if (lower === 'xin chào' || lower === 'chào') {
        userLang = 'vi';
        console.log('  Language detected from greeting: Vietnamese');
      } else if (lower === 'hello' || lower === 'hi' || lower === 'hey') {
        userLang = 'en';
        console.log('  Language detected from greeting: English');
      } else if (lower === 'guten tag' || lower === 'hallo') {
        userLang = 'de';
        console.log('  Language detected from greeting: German');
      }
      
      await updateCustomerState(contact_id, user_name, 'normal', userLang);
    }
    
    // 2. Check if customer wants to switch to NORMAL
    if (customerWantsNormalBooking(user_message)) {
      console.log('🔄 Customer requesting NORMAL booking - switching type to NORMAL');
      customerType = 'normal';
      await updateCustomerState(contact_id, user_name, 'normal', userLang);
    }
    
    // 3. Detect/Update language
    if (!userLang) {
      // First time - detect language
      userLang = await detectLanguageWithAI(user_message, history);
      console.log(`🌍 First-time language detection: ${userLang}`);
      await updateCustomerState(contact_id, user_name, customerType, userLang);
    } else {
      // Check if user switched language
      const currentMsgLang = detectLanguage(user_message);
      if (currentMsgLang !== userLang) {
        const lower = user_message.toLowerCase();
        
        // Strong signals for Vietnamese
        const vietnameseSignals = [
          'xin chào', 'chào', 'cảm ơn', 'tôi muốn', 'mình muốn', 'bạn', 'được không', 'bảng giá',
          'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy', 'chủ nhật',
          'khách thường', 'làm móng', 'đặt lịch', 'ngày mai', 'hôm nay', 'chi tiết',
          'mình', 'đăng ký', 'khách hàng', 'khách mẫu', 'học viên', 'giá', 'bao nhiêu',
          'được', 'không', 'thế nào', 'làm', 'có thể'
        ];
        
        // Strong signals for English
        const englishSignals = [
          'hello', 'hi', 'thank you', 'i want', 'i would', 'can i', 'price list',
          'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
          'regular customer', 'appointment', 'tomorrow', 'today', 'menu', 'detail',
          'price', 'assume', 'please', 'modell', 'model', 'trainee'
        ];
        
        // Strong signals for German
        const germanSignals = [
          'guten tag', 'hallo', 'danke', 'ich möchte', 'ich will', 'kann ich', 'preisliste',
          'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag',
          'normaler kunde', 'termin', 'morgen', 'heute'
        ];
        
        const hasVietnameseSignal = vietnameseSignals.some(s => lower.includes(s));
        const hasEnglishSignal = englishSignals.some(s => lower.includes(s));
        const hasGermanSignal = germanSignals.some(s => lower.includes(s));
        
        let hasStrongSignal = false;
        
        if (currentMsgLang === 'vi' && hasVietnameseSignal) {
          hasStrongSignal = true;
        } else if (currentMsgLang === 'en' && hasEnglishSignal) {
          hasStrongSignal = true;
        } else if (currentMsgLang === 'de' && hasGermanSignal) {
          hasStrongSignal = true;
        }
        
        if (hasStrongSignal) {
          console.log(`🔄 Language switched: ${userLang} → ${currentMsgLang} (strong signal detected)`);
          userLang = currentMsgLang;
          await updateCustomerState(contact_id, user_name, customerType, userLang);
        } else {
          console.log(`  Language hint: ${currentMsgLang}, but keeping saved: ${userLang} (no strong signal)`);
        }
      }
    }
    
    // 4. Determine customer type (if not set AND not explicitly normal)
    // CRITICAL: Check for DECLINE before classifying!
    const lower = user_message.toLowerCase().trim();
    const decliningPhrases = [
      'không muốn', 'k muốn', 'ko muốn', 'khong muon',
      'nicht', 'not', 'don\'t want', 'dont want',
      'nein', 'no thanks', 'no thank',
      'thôi', 'thoi', 'cancel',
      'khách thường', 'normal customer', 'normaler kunde'
    ];
    
    const isDecliningModell = decliningPhrases.some(phrase => 
      lower.includes(phrase) && 
      (lower.includes('mẫu') || lower.includes('modell') || lower.includes('model'))
    );
    
    if (isDecliningModell && (customerType === 'modell' || !customerType)) {
      console.log(`🔄 Customer DECLINING modell service - setting to NORMAL`);
      customerType = 'normal';
      await updateCustomerState(contact_id, user_name, 'normal', userLang);
    } else if (!customerType) {
      const isModell = await classifyCustomerIntent(user_message, history);
      customerType = isModell ? 'modell' : 'normal';
      console.log(`🎯 First-time customer type detection: ${customerType}`);
      await updateCustomerState(contact_id, user_name, customerType, userLang);
    } else if (customerType === 'normal') {
      // Re-check if normal customer is now asking about modell
      const isModell = await classifyCustomerIntent(user_message, history);
      if (isModell) {
        console.log(`🔄 Customer switching from NORMAL to MODELL`);
        customerType = 'modell';
        await updateCustomerState(contact_id, user_name, 'modell', userLang);
      }
    } else if (customerType === 'modell') {
      // Already checked decline above, but keep this for clarity
      if (isDecliningModell) {
        console.log(`🔄 Customer DECLINING modell service - switching to NORMAL`);
        customerType = 'normal';
        await updateCustomerState(contact_id, user_name, 'normal', userLang);
      }
    }
    
    console.log(`✅ Final state: customerType=${customerType}, userLang=${userLang}`);
    console.log('=== END CUSTOMER STATE ===\n');

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
    
    // If user just sent a greeting, ALWAYS greet back (override skip logic)
    const userJustGreeted = ['xin chào', 'hello', 'hi', 'hey', 'guten tag', 'hallo', 'chào'].includes(lower);
    const shouldSkipGreeting = (hasGreeted || isReturningCustomer) && !userJustGreeted;
    
    if (shouldSkipGreeting) {
      console.log(`✓ Skip greeting - hasGreeted: ${hasGreeted}, isReturning: ${isReturningCustomer}`);
    } else if (userJustGreeted) {
      console.log(`✓ User just greeted - WILL greet back even if returning customer`);
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
    
    // STEP 1: Summarize user intent using AI
    console.log('📝 Step 1: Summarizing user intent...');
    let userIntentSummary = '';
    try {
      const intentCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that summarizes customer messages for a nail salon.

Analyze the customer's message and conversation context to provide a brief summary of:
1. What the customer wants (appointment, price info, model customer, normal customer, question, etc.)
2. Any specific details (day, time, service type, customer type change)
3. Customer's sentiment and important context

CRITICAL - DETECT CUSTOMER TYPE CHANGES:
- If customer says "khách thường" / "regular customer" / "normaler kunde" → Note: "Customer wants to switch to NORMAL customer"
- If customer says "modell" / "model" / "mẫu" → Note: "Customer asking about MODEL customer"
- If customer is just greeting ("hello", "xin chào", "hallo") → Note: "Customer greeting / restarting conversation"
- If customer says "bảng giá" / "price list" / "preisliste" → Note: "Customer asking for price list"

Keep it under 80 words. Be concise and factual.

Examples:
Input: "tôi muốn đặt lịch chủ nhật 17h"
Output: "Customer wants appointment on Sunday at 5pm (17h). Vietnamese speaker. Normal booking request."

Input: "mình muốn đặt lịch như khách thường"
Output: "Customer wants to switch to NORMAL customer (not model). Requesting regular booking. Vietnamese speaker."

Input: "bảng giá khách thường"
Output: "Customer asking for NORMAL customer price list (not model prices). Vietnamese speaker."

Input: "modell preis"
Output: "Customer asking about MODEL customer prices. German speaker."

Input: "xin chào"
Output: "Customer greeting in Vietnamese. Fresh start / restart conversation."

Input: "ja ok Saturday 2pm"
Output: "Customer agrees and suggests Saturday 2pm. Confirmation message."`
          },
          {
            role: 'user',
            content: `Customer message: "${user_message}"

Recent conversation context:
${historyText.substring(Math.max(0, historyText.length - 800))}

Customer type from system: ${customerType}
Customer language: ${userLang}`
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      });
      
      userIntentSummary = intentCompletion.choices[0].message.content.trim();
      console.log(`📝 User intent summary: ${userIntentSummary}`);
    } catch (error) {
      console.error('❌ Intent summarization error:', error);
      userIntentSummary = `Customer says: "${user_message}"`;
    }
    
    // userLang already determined from customer state above
    console.log(`🌍 Using language from state: ${userLang}`);

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

🎯🎯🎯 CRITICAL - READ THE INTENT SUMMARY FIRST 🎯🎯🎯

📝 CUSTOMER INTENT SUMMARY (what customer wants):
${userIntentSummary}

⚠️ IMPORTANT: Base your response on this intent summary!
- If summary says "wants appointment" → help with booking
- If summary says "asking about prices" → give price info
- If summary says "switching to normal customer" → treat as normal, not modell
- If summary says "greeting/restart" → give fresh greeting

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

🎯🎯🎯 CRITICAL - READ THE INTENT SUMMARY FIRST 🎯🎯🎯

📝 CUSTOMER INTENT SUMMARY (what customer wants):
${userIntentSummary}

⚠️ IMPORTANT: Base your response on this intent summary!

---

🔴🔴🔴 CRITICAL LANGUAGE INSTRUCTION 🔴🔴🔴
THE CUSTOMER IS WRITING IN: ${detectedLangName}
YOU MUST RESPOND IN: ${detectedLangName}

This is a ${history.length === 0 ? 'NEW' : 'CONTINUING'} conversation.
Greet and answer in ${detectedLangName}.`;

    console.log(`🔍 DEBUG - User message: "${user_message}"`);
    console.log(`🔍 DEBUG - History length: ${history.length}`);
    console.log(`🔍 DEBUG - History (last 3 messages):`);
    history.slice(-3).forEach(msg => {
      console.log(`  [${msg.role}]: ${msg.message.substring(0, 100)}...`);
    });
    
    // ========== CUSTOMER TYPE ROUTING ==========
    console.log(`\n🎯 === ROUTING BY CUSTOMER TYPE: ${customerType} ===`);
    
    if (customerType === 'modell') {
      console.log('🎨 MODELL CUSTOMER FLOW');
      
      // Check 1: Is customer trying to book (already modellkunde + acceptance + datetime)?
      console.log('\n🔍 Step 1: Checking if customer is booking (isModellkundeAcceptanceWithBooking)...');
      const isModellBooking = isModellkundeAcceptanceWithBooking(user_message, history);
      console.log(`🔍 Result: isModellBooking = ${isModellBooking}\n`);
      
      if (isModellBooking) {
        console.log('🎯 Modellkunde customer is booking - sending booking link');
        
        let bookingMessage;
        if (userLang === 'vi') {
          bookingMessage = MODELL_BOOKING_MESSAGE_VI;
        } else if (userLang === 'en') {
          bookingMessage = MODELL_BOOKING_MESSAGE_EN;
        } else {
          bookingMessage = MODELL_BOOKING_MESSAGE;
        }
        
        console.log(`📝 Sending Modell booking message (${userLang})`);
        
        res.json({
          bot_response: bookingMessage,
          bot_response_2: "EMPTY_RESPONSE",
          bot_response_3: "EMPTY_RESPONSE"
        });
            
        await saveMessage(contact_id, user_name, 'user', user_message).catch(err => {
          console.error('Failed to save user message:', err.message);
        });
        await saveMessage(contact_id, user_name, 'assistant', bookingMessage).catch(err => {
          console.error('Failed to save assistant message:', err.message);
        });

        getChatHistory(contact_id).then(updatedHistory => {
          updateConversationSummary(contact_id, user_name, updatedHistory).catch(err => {
            console.error('Failed to update summary:', err.message);
          });
        });
        
        return; // EXIT - don't call AI
      }
      
      // Check 2: Is this first-time modellkunde query?
      console.log('🔍 Step 2: Checking if should send modell info (isModellkundeConversation)...');
      const shouldSendModellInfo = await isModellkundeConversation(user_message, history, customerType);
      console.log(`🔍 Result: shouldSendModellInfo = ${shouldSendModellInfo}\n`);

      if (shouldSendModellInfo) {
        console.log('✅ SENDING MODELL INFO - SKIP AI');
        
        const alreadyGreeted = history.some(msg => 
          msg.role === 'assistant'
        );
        
        console.log(`  alreadyGreeted: ${alreadyGreeted}`);
        console.log(`  userLang: ${userLang}`);
        
        let modellMessage;
        if (userLang === 'vi') {
          modellMessage = MODELL_MESSAGE_VI;
          if (alreadyGreeted) {
            modellMessage = modellMessage.replace('Xin chào! 😊\n', '');
          }
        } else if (userLang === 'en') {
          modellMessage = MODELL_MESSAGE_EN;
          if (alreadyGreeted) {
            modellMessage = modellMessage.replace('Hello! 😊\n', '');
          }
        } else {
          modellMessage = MODELL_MESSAGE;
          if (alreadyGreeted) {
            modellMessage = modellMessage.replace('Guten Tag! 😊\n', '');
          }
        }
        
        console.log(`  modellMessage length: ${modellMessage ? modellMessage.length : 'NULL'}`);
        console.log(`  modellMessage preview: ${modellMessage ? modellMessage.substring(0, 50) : 'NULL'}...`);
        
        if (!modellMessage || modellMessage.trim().length === 0) {
          console.error('❌ ERROR: modellMessage is empty!');
          throw new Error('Modell message is empty');
        }
        
        res.json({
          bot_response: modellMessage,
          bot_response_2: "EMPTY_RESPONSE",
          bot_response_3: "EMPTY_RESPONSE"
        });
        
        console.log('✅ Response sent successfully');
            
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
        
        return; // EXIT - don't call AI
      }
      
      // If neither booking nor first-time modell, continue to AI
      console.log('📞 Modell customer - continuing to AI for general questions');
    } else {
      // customerType === 'normal'
      console.log('👤 NORMAL CUSTOMER FLOW - using AI directly');
    }
    
    console.log('=== END ROUTING ===\n');
    
    // ========== AI RESPONSE (for both normal customers and modell customers with general questions) ==========
    
    // If NOT modellkunde-related, call AI as normal
    console.log('📞 Calling AI for response...');
    
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
