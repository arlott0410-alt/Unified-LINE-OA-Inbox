# Deploy บน Render ผ่าน GitHub (Step-by-Step)

ทำตามลำดับด้านล่างเพื่อให้ระบบรันบน Render ได้

---

## สิ่งที่ต้องมีก่อนเริ่ม

- บัญชี [Render](https://render.com) (ใช้ GitHub login ได้)
- Repo บน GitHub: `https://github.com/arlott0410-alt/Unified-LINE-OA-Inbox` (push โค้ดขึ้นไปแล้ว)

---

## ขั้นที่ 1: สร้าง PostgreSQL บน Render

1. เข้า [Render Dashboard](https://dashboard.render.com) → **New +** → **PostgreSQL**
2. ตั้งชื่อ เช่น `unified-line-inbox-db`
3. เลือก Region (เช่น Singapore)
4. Plan เลือก **Free** หรือตามต้องการ
5. กด **Create Database**
6. รอสร้างเสร็จ แล้วไปที่ **Info** → copy ค่า **Internal Database URL** (หรือ External ถ้า deploy คนละกลุ่มกับ DB)
   - เก็บค่าไว้ใช้เป็น `DATABASE_URL` ในขั้นตอนถัดไป

---

## ขั้นที่ 2: สร้าง Redis บน Render

Render ไม่มี Redis ในตัว — ใช้บริการภายนอกได้ดังนี้:

**ตัวเลือก A: Upstash (มี Free tier)**  
1. ไปที่ [Upstash](https://upstash.com) → สมัคร/ล็อกอิน  
2. สร้าง Redis database → เลือก Region ใกล้กับ Render  
3. Copy **Redis URL** (แบบ TLS เช่น `rediss://default:xxx@xxx.upstash.io:6379`)  
4. เก็บไว้เป็น `REDIS_URL`

**ตัวเลือก B: Render Redis (ถ้ามีในแผนที่ใช้)**  
- ถ้าแผนของคุณมี Redis ให้สร้างจาก Render แล้วใช้ Internal Redis URL เป็น `REDIS_URL`

---

## ขั้นที่ 3: สร้าง Web Service สำหรับ API (Backend)

1. ใน Render → **New +** → **Web Service**
2. **Connect repository**: เลือก GitHub แล้วเลือก repo **Unified-LINE-OA-Inbox**
3. ตั้งค่า:
   - **Name**: `unified-line-inbox-api` (หรือชื่ออื่น)
   - **Region**: เลือกเดียวกับ PostgreSQL
   - **Branch**: `main`
   - **Root Directory**: ใส่ `backend`
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `Dockerfile` (อยู่ที่ root ของ backend = `backend/Dockerfile`)
   - **Instance Type**: Free หรือตามต้องการ

4. **Environment Variables** — กด **Add Environment Variable** แล้วเพิ่ม:

   | Key | Value | หมายเหตุ |
   |-----|--------|----------|
   | `DATABASE_URL` | (paste จากขั้นที่ 1) | Internal Database URL จาก PostgreSQL |
   | `REDIS_URL` | (paste จากขั้นที่ 2) | Redis URL จาก Upstash หรือ Render |
   | `SESSION_SECRET` | สร้างค่าสุ่มยาว เช่น `openssl rand -hex 32` | ใช้ sign session |
   | `ENCRYPTION_KEY` | สร้างค่าสุ่มอย่างน้อย 32 ตัวอักษร | ใช้ encrypt LINE token |
   | `FRONTEND_URL` | ยังไม่ใส่ก็ได้ | ใส่หลังสร้าง Frontend แล้ว (เช่น `https://unified-line-inbox.onrender.com`) |

5. กด **Create Web Service**
6. รอ build และ deploy จน status เป็น **Live**
7. Copy **URL ของ service** (เช่น `https://unified-line-inbox-api.onrender.com`) — ใช้เป็น API URL และสำหรับ LINE webhook

---

## ขั้นที่ 4: สร้าง Background Worker

1. **New +** → **Background Worker**
2. เลือก repo เดิม: **Unified-LINE-OA-Inbox**
3. ตั้งค่า:
   - **Name**: `unified-line-inbox-worker`
   - **Root Directory**: `backend`
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `Dockerfile.worker`

4. **Environment Variables** — **ต้องใส่ทั้งสองตัว** (ถ้าไม่มี Worker จะ exit ทันที):
   - `DATABASE_URL` = ค่าเดียวกับ API (Internal Database URL)
   - `REDIS_URL` = Redis URL (จาก Upstash หรือ Render Redis)

5. **Create Background Worker**
6. รอ deploy จน Worker ขึ้นสถานะ Running

**ถ้า Worker แสดง "Instance failed" / Exited with status 1:**
- ไปที่ **Logs** ของ Worker (เมนู Logs ด้านซ้าย) ดูข้อความ error **บรรทัดล่าสุดก่อนล้ม** (เช่น `REDIS_URL is not set`, `DATABASE_URL is not set`, `Redis connection error`, `Unhandled Rejection`, หรือ Prisma/DB error)
- ตรวจว่า **Environment** ของ Worker มี `REDIS_URL` และ `DATABASE_URL` ครบ (ใช้ค่าเดียวกับ API — Internal Database URL, Internal Redis URL)
- ถ้าเห็นข้อความชัดเจนใน Logs ให้ copy ส่งมาจะช่วยไล่แก้ต่อได้

**ถ้า Worker รันได้สักพักแล้วล้มเรื่อยๆ:**
- มักมาจาก Redis หรือ DB ตัด connection ตอน idle — โค้ดมี retry/reconnect แล้ว ควรช่วยได้หลัง deploy ล่าสุด
- ดู **Logs** ว่ามี `Redis connection closed` / `Redis reconnecting` หรือ error อื่นก่อนล้ม แล้วส่งข้อความนั้นมาจะช่วยไล่ต่อได้

---

## ขั้นที่ 5: สร้าง Web Service สำหรับ Frontend (Same-Origin Proxy)

1. **New +** → **Web Service**
2. เลือก repo **Unified-LINE-OA-Inbox**
3. ตั้งค่า:
   - **Name**: `unified-line-inbox` (หรือชื่ออื่น)
   - **Root Directory**: `frontend`
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `Dockerfile`

4. **Environment Variables** (บังคับสำหรับ proxy ไป backend):
   - **Key**: `INTERNAL_API_URL`
   - **Value**: Backend ผ่าน **Render Private Network** — ใช้ชื่อ service ของ API + port  
   - ตัวอย่าง: `http://unified-line-oa-inbox:10000` (ถ้า API service ชื่อ `unified-line-oa-inbox` และ Render ตั้ง PORT=10000)  
   - ดู port ได้จาก API service → **Info** → **Port** (มักเป็น 10000)  
   - ไม่ใส่ slash ท้าย URL

5. **Create Web Service**
6. รอ deploy แล้ว copy URL ของ Frontend (เช่น `https://unified-line-inbox.onrender.com`)

**สถาปัตยกรรม:** Browser เรียกเฉพาะโดเมน Frontend (`/api/auth/login`, `/api/auth/me` ฯลฯ) Next.js จะ proxy ไปยัง backend ผ่าน Private Network ดังนั้นไม่ต้องใช้ CORS และ session cookie เป็น first-party บนโดเมน Frontend

**Realtime (Socket.IO):** ถ้าต้องการให้แชท realtime ทำงาน ตั้ง `NEXT_PUBLIC_API_URL` = URL สาธารณะของ API (เช่น `https://unified-line-oa-inbox.onrender.com`) เพื่อให้ client ต่อ Socket.IO ไปที่ backend ได้ (auth ยังคงผ่าน proxy same-origin)

---

## ขั้นที่ 6: API — ไม่ต้องตั้ง CORS สำหรับ Browser

Browser ไม่ได้เรียก API โดยตรง (เรียกผ่าน Frontend proxy) ดังนั้น API **ไม่ต้องตั้ง** `FRONTEND_URL` สำหรับ CORS

---

## ขั้นที่ 7: สร้าง Admin คนแรก (Seed)

1. ไปที่ API service → **Shell** (หรือใช้ Render Shell ถ้ามี)
2. (ถ้าต้องการเปลี่ยนรหัสหรือชื่อ admin) ไปที่ **Environment** ของ API แล้วเพิ่มตัวแปร (ไม่บังคับ):
   - `SEED_ADMIN_NAME` = ชื่อ login (ค่าเริ่มต้น `ARLOTT`)
   - `SEED_ADMIN_PASSWORD` = รหัสผ่าน (ค่าเริ่มต้น `arlottokace`)
3. รันคำสั่ง (ใน container ของ API) **ตามลำดับนี้**:

   **ขั้นที่ 1 — รัน migration ก่อน** (สร้างตารางใน DB ถ้ายังไม่มี):

   ```bash
   npx prisma migrate deploy
   ```

   **ขั้นที่ 2 — ค่อยรัน seed** (สร้าง admin คนแรก):

   ```bash
   npx prisma db seed
   ```

   (ถ้าไม่รัน migrate deploy ก่อน จะ error ประมาณ `The table 'public.Agent' does not exist` เพราะตารางยังไม่ถูกสร้าง)

   (โปรเจกต์ใช้ `node prisma/seed.js` แล้ว จึงรันได้ใน production โดยไม่ต้องมี ts-node)

   หรือถ้า Render ไม่เปิด Shell ให้ใช้ **One-off Job** (ถ้ามี):
   - New → Background Worker ชั่วคราว หรือใช้คำสั่ง release/start ที่รัน seed ครั้งเดียว

4. หลัง seed สำเร็จ จะมี admin (หรืออัปเดตรหัสของ admin เดิมถ้ามีอยู่แล้ว):
   - **Name**: `ARLOTT`
   - **Password**: `arlottokace`  
   (หรือตามที่ตั้งใน `SEED_ADMIN_NAME` / `SEED_ADMIN_PASSWORD` ถ้ามี)

ถ้าไม่มี Shell: สร้าง admin ผ่าน SQL ใน Render PostgreSQL tab **Connect** → ใช้ client รัน SQL ที่ insert ลงตาราง `agents` (ต้อง hash password ด้วย bcrypt ก่อน)

---

## ขั้นที่ 8: ทดสอบการใช้งาน

1. เปิด URL ของ **Frontend** ในเบราว์เซอร์
2. Login ด้วย `ARLOTT` / `arlottokace` (หรือตามที่ seed ตั้ง)
3. ควรเข้า Inbox ได้ (อาจยังไม่มี conversation)

**หมายเหตุ:** ล็อกอินใช้ **API** เท่านั้น (ไม่ใช้ Worker) — Worker ล้มไม่ทำให้ล็อกอินไม่ได้โดยตรง

**ถ้า Login ได้ 404 หรือ 502 / proxy error:**
- **สาเหตุ:** Frontend proxy ไป backend ไม่ได้ (เช่น `INTERNAL_API_URL` ผิด หรือ backend ยังไม่ขึ้น)
- **แก้:** ไปที่ **Frontend** → **Environment** → ตั้ง `INTERNAL_API_URL` = **Private Network URL ของ API** (เช่น `http://unified-line-oa-inbox:10000` — ใช้ชื่อ API service จริงและ port จาก API service Info)
- ตรวจว่า API service กับ Frontend อยู่ **กลุ่ม (Environment) เดียวกัน** บน Render เพื่อให้ Private Network ใช้ได้

**ถ้าได้ 401 ตอนกด Sign in (POST /api/auth/login คืน 401):**
- **สาเหตุ:** Backend รับ request แล้วแต่ตรวจสอบชื่อ/รหัสไม่ผ่าน (ไม่มี user ใน DB หรือรหัสผิด)
- **แก้:** ไปที่ **API** service → **Shell** รัน `npx prisma migrate deploy` แล้วรัน `npx prisma db seed` (ขั้นที่ 7)
- ใช้ **ชื่อและรหัสที่ seed สร้าง** เท่านั้น (ค่าเริ่มต้น `ARLOTT` / `arlottokace` หรือตาม `SEED_ADMIN_NAME` / `SEED_ADMIN_PASSWORD`)

**ถ้ากด Sign in แล้วเด้งกลับ (401 ที่ `api/auth/me`):**
- หลังล็อกอินระบบจะ **redirect แบบ full page** ไป `/inbox` เพื่อให้ browser ส่ง session cookie กับ request ใหม่ (ถ้าใช้ client-side redirect บาง browser อาจยังไม่ส่ง cookie ทันเวลา)
- ตรวจว่า cookie ถูกตั้งหลัง login: เปิด DevTools → Application → Cookies → ดูโดเมนของ Frontend ว่ามี session cookie หรือไม่
- ถ้าไม่มี: ตรวจ Logs ของ Frontend ว่า proxy ส่ง Set-Cookie กลับมาหรือไม่ และว่า `INTERNAL_API_URL` ชี้ไป backend ที่รันอยู่จริง

---

## ขั้นที่ 9: ต่อ LINE Official Account (เมื่อพร้อม)

1. ในฐานข้อมูล (หรือผ่าน script ที่คุณเขียน) เพิ่มแถวในตาราง `oa_accounts`:
   - `name`: ชื่อ OA
   - `channel_access_token_encrypted`: encrypt ค่า Channel Access Token ด้วย `ENCRYPTION_KEY`
   - `channel_secret_encrypted`: encrypt ค่า Channel Secret ด้วย `ENCRYPTION_KEY`
   - `is_active`: `true`

2. ใน LINE Developers Console → Channel → Messaging API:
   - **Webhook URL**:  
     `https://<API-URL>/api/webhooks/line/<oa_id>`  
     เช่น `https://unified-line-inbox-api.onrender.com/api/webhooks/line/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - เปิด **Use webhook**

---

## สรุป Services บน Render

| Service | Type | Root Directory | Dockerfile | หมายเหตุ |
|--------|------|----------------|------------|----------|
| API | Web Service | `backend` | `Dockerfile` | รัน migration ตอน start แล้ว start server |
| Worker | Background Worker | `backend` | `Dockerfile.worker` | รับ job จาก Redis |
| Frontend | Web Service | `frontend` | `Dockerfile` | ใช้ `NEXT_PUBLIC_API_URL` ชี้ไปที่ API |

---

## ถ้า API แสดง "Failed deploy" หรือ Worker แสดง "Failed service"

**API (Failed deploy) — ตรวจตามนี้:**
1. **Settings** ของ API service: **Root Directory** ต้องเป็น `backend` และ **Dockerfile Path** ต้องเป็น `Dockerfile` (ไม่ใช่ backend/Dockerfile ถ้า Root Directory เป็น backend แล้ว)
2. ไปที่ **Logs** → ดูข้อความ error ตอน **Build** (เช่น `Module not found`, `Cannot find module '@nestjs/jwt'`) หรือตอน **Deploy** (เช่น `SESSION_SECRET must be set`)
3. **Environment** ของ API ต้องมี: `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY` (และ `FRONTEND_URL` ถ้าใช้ Frontend คนละโดเมน)
4. ถ้า Build ล้มที่ `npm install`: ลองกด **Clear build cache & deploy** แล้ว deploy ใหม่

**Worker (Failed service) — ตรวจตามนี้:**
1. **Settings**: **Root Directory** = `backend`, **Dockerfile Path** = `Dockerfile.worker`
2. **Environment** ของ Worker **ต้องมีทั้งสองตัว** (ใช้ค่าเดียวกับ API):
   - `DATABASE_URL` = Internal Database URL จาก PostgreSQL (เช่น `postgres://...@.../...`)
   - `REDIS_URL` = Redis URL (จาก Upstash เป็น `rediss://...` หรือ Render Valkey Internal URL)
3. ไปที่ **Logs** ของ Worker ดูข้อความก่อนล้ม:
   - เห็น `REDIS_URL is not set` หรือ `DATABASE_URL is not set` → ไปเพิ่มใน Environment แล้ว Save (Render จะ redeploy ให้)
   - เห็น `Redis connection error` / `ECONNREFUSED` → ตรวจว่า Redis ยังใช้ได้ และถ้าใช้ Upstash ต้องใช้ URL ที่ copy จาก Upstash dashboard
   - เห็น `The table '...' does not exist` → รัน migration ที่ API ก่อน (ใน Shell ของ API: `npx prisma migrate deploy`) แล้ว redeploy Worker

---

## หมายเหตุสำคัญ

- **Free tier**: Web Service จะ sleep เมื่อไม่มี traffic; request แรกอาจช้า
- **DATABASE_URL**: ใช้ Internal URL ถ้า DB กับ Service อยู่กลุ่มเดียวกัน จะเร็วกว่า
- **INTERNAL_API_URL (Frontend)**: ต้องเป็น **Private Network URL** ของ API (เช่น `http://unified-line-oa-inbox:10000`) — Frontend ใช้ค่านี้เพื่อ proxy ไป backend ไม่ใช่ให้ browser เรียกโดยตรง ดู [Private Network](https://render.com/docs/private-network)
- **Session / Cookie**: Browser เรียกเฉพาะ Frontend; Next.js proxy ส่ง cookie ไป backend และส่ง Set-Cookie กลับมา ดังนั้น session เป็น first-party บนโดเมน Frontend (ไม่ต้องใช้ CORS / sameSite none)
- **Redis (Upstash)**: Free tier มี limit การเรียกใช้ ตรวจได้ที่ Upstash dashboard

ถ้าต้องการให้ช่วยออกแบบ “หน้าเพิ่ม OA” หรือ script encrypt token ให้บอกได้ครับ
