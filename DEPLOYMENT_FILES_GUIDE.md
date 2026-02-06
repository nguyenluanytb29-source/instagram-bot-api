# ✅ FILES ĐỂ DEPLOY - CHECKLIST

## 📦 3 FILES CHÍNH (BẮT BUỘC)

Tôi đã gửi lại 3 files trong outputs:

1. ✅ **server.js** - Main API code
2. ✅ **package.json** - Dependencies
3. ✅ **.env.example** - Environment variables template (chỉ tham khảo)

---

## 🎯 CÁCH UPLOAD LÊN GITHUB

### Option A: Upload qua Web (Đơn giản nhất)

1. **Download 3 files** về máy từ outputs folder
2. Vào GitHub repository: `instagram-bot-api`
3. **Delete tất cả files cũ** (nếu có):
   - Click vào file → Click icon 3 chấm → Delete
   - Commit: "Remove old files"
4. **Upload files mới:**
   - Click **"Add file"** → **"Upload files"**
   - Kéo thả 3 files vào:
     - server.js
     - package.json
     - .env.example
   - Commit message: "Fresh deploy"
   - Click **"Commit changes"**

---

### Option B: Tạo từng file thủ công

**FILE 1: server.js**
1. Repository → **"Add file"** → **"Create new file"**
2. Name: `server.js`
3. Copy TOÀN BỘ nội dung từ file `server.js` (đã download)
4. Paste vào
5. **Commit changes**

**FILE 2: package.json**
1. **"Add file"** → **"Create new file"**
2. Name: `package.json`
3. Copy toàn bộ nội dung
4. Paste
5. **Commit changes**

**FILE 3: .env.example** (Không bắt buộc, chỉ tham khảo)
1. **"Add file"** → **"Create new file"**
2. Name: `.env.example`
3. Copy nội dung
4. Paste
5. **Commit changes**

---

## ✅ VERIFY FILES

**Sau khi upload, GitHub phải có:**

```
📁 instagram-bot-api
  📄 server.js (6.4KB)
  📄 package.json (561 bytes)
  📄 .env.example (408 bytes) [optional]
  📄 README.md
```

---

## 🔍 VERIFY server.js CONTENT

**Mở file `server.js` trên GitHub, check:**

**Dòng 1-10 phải có:**
```javascript
// server.js - Instagram AI Bot API with Memory
// Tech stack: Node.js + Express + PostgreSQL + OpenAI

const express = require('express');
const { Pool } = require('pg');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());
```

**Dòng cuối cùng phải có:**
```javascript
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
```

✅ Nếu đúng → OK!

---

## 🔍 VERIFY package.json CONTENT

**Mở `package.json`, phải có:**

```json
{
  "name": "instagram-ai-bot-api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "openai": "^4.28.0",
    "dotenv": "^16.4.1"
  }
}
```

✅ Đủ 4 dependencies → OK!

---

## 🚀 SAU KHI UPLOAD

### Railway sẽ tự động:

1. **Detect changes** trên GitHub
2. **Trigger new deployment**
3. **Install dependencies** từ package.json
4. **Run** `npm start` (= `node server.js`)

**Timeline:**
```
00:00 - Push to GitHub
00:30 - Railway detect
01:00 - Start build
02:00 - Install dependencies
03:00 - Deploy complete ✅
```

---

## ⚠️ QUAN TRỌNG

### Sau khi Railway deploy xong:

**VẪN PHẢI ADD VARIABLES:**

1. Service `instagram-bot-api` → **Variables**
2. Add:
   ```
   OPENAI_API_KEY = sk-proj-your-key-here
   ```
3. `DATABASE_URL` tự động có (từ Postgres)

**KHÔNG add variables → VẪN CRASHED!**

---

## 📋 DEPLOYMENT CHECKLIST

- [ ] ✅ 3 files uploaded lên GitHub
- [ ] ✅ Files content đúng (verify server.js & package.json)
- [ ] ✅ Railway detect changes
- [ ] ✅ Deployment triggered
- [ ] ✅ Build success
- [ ] ⚠️ Service crashed (chưa có OPENAI_API_KEY)
- [ ] ✅ Add OPENAI_API_KEY variable
- [ ] ✅ Railway redeploy
- [ ] ✅ Service Active 🟢
- [ ] ✅ Logs: "Server running"

---

## 🎯 TIMELINE ĐẦY ĐỦ

```
STEP 1: Upload files to GitHub (5 phút)
  ↓
STEP 2: Railway auto deploy (2-3 phút)
  ↓
STEP 3: Service crashed (thiếu OPENAI_API_KEY)
  ↓
STEP 4: Add OPENAI_API_KEY (1 phút)
  ↓
STEP 5: Railway redeploy (2 phút)
  ↓
STEP 6: Service Active ✅
  ↓
STEP 7: Get API URL
  ↓
STEP 8: Setup ManyChat
  ↓
STEP 9: Test
  ↓
DONE! 🎉
```

**Tổng thời gian: ~15-20 phút**

---

## 💡 TIPS

1. **Upload files mới → Xóa files cũ trước**
   - Tránh conflict với code cũ
   
2. **Verify content sau upload**
   - Click vào từng file
   - Check syntax đúng
   
3. **Chờ Railway deploy xong**
   - Tab Deployments → Wait for Success
   - Đừng rush add variables ngay
   
4. **Add OPENAI_API_KEY đúng format**
   - Name: `OPENAI_API_KEY` (in HOA)
   - Value: `sk-proj-xxx` (không space)

---

## 📞 NẾU GẶP VẤN ĐỀ

**Gửi cho tôi:**
1. Screenshot GitHub files list
2. Screenshot Railway Deployments
3. Screenshot Railway Logs
4. Error message (nếu có)

**Tôi sẽ debug ngay!**

---

**Bắt đầu upload files lên GitHub ngay nhé!** 🚀

**Chỉ 15-20 phút nữa là xong!** ⚡
