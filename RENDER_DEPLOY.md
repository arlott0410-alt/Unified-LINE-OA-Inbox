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

## ขั้นที่ 5: สร้าง Web Service สำหรับ Frontend

1. **New +** → **Web Service**
2. เลือก repo **Unified-LINE-OA-Inbox**
3. ตั้งค่า:
   - **Name**: `unified-line-inbox` (หรือชื่ออื่น)
   - **Root Directory**: `frontend`
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `Dockerfile`

4. **Environment Variables**:
   - **Key**: `NEXT_PUBLIC_API_URL` หรือ `API_URL`  
   - **Value**: URL สาธารณะของ API (เช่น `https://unified-line-oa-inbox.onrender.com`)  
   - ไม่ใส่ slash ท้าย URL  
   - (Frontend อ่านค่าตอน runtime ผ่าน `/api/config` ดังนั้นไม่ต้อง rebuild แค่ Save env แล้ว redeploy)

5. **Create Web Service**
6. รอ deploy แล้ว copy URL ของ Frontend (เช่น `https://unified-line-inbox.onrender.com`)

---

## ขั้นที่ 6: กลับไปตั้งค่า CORS และ Session Cookie ที่ API

1. ไปที่ Web Service ของ **API** (unified-line-inbox-api)
2. **Environment** → ตั้ง `FRONTEND_URL` ให้เป็น URL จริงของ Frontend (ต้องตั้ง ไม่ใช่แค่ CORS)
   - ตัวอย่าง: `https://unified-line-inbox.onrender.com`
   - ใช้ได้แค่ origin เดียว อย่าใส่ slash ท้าย
3. Save → Render จะ redeploy API ให้เอง

**สำคัญ:** ถ้าไม่ตั้ง `FRONTEND_URL` หรือตั้งผิดโดเมน ล็อกอินจะสำเร็จแต่พอเข้า /inbox จะเด้งกลับไปหน้า login เพราะ session cookie ไม่ถูกส่งข้ามโดเมน (API ต้องตั้ง cookie แบบ `sameSite: none` เมื่อมี FRONTEND_URL)

---

## ขั้นที่ 7: สร้าง Admin คนแรก (Seed)

1. ไปที่ API service → **Shell** (หรือใช้ Render Shell ถ้ามี)
2. (ถ้าต้องการเปลี่ยนรหัสหรือชื่อ admin) ไปที่ **Environment** ของ API แล้วเพิ่มตัวแปร (ไม่บังคับ):
   - `SEED_ADMIN_NAME` = ชื่อ login (ค่าเริ่มต้น `admin`)
   - `SEED_ADMIN_PASSWORD` = รหัสผ่าน (ค่าเริ่มต้น `admin123`)
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

4. หลัง seed สำเร็จ จะมี admin:
   - **Name**: `admin`
   - **Password**: `admin123`  
   (หรือตามที่ตั้งใน `SEED_ADMIN_NAME` / `SEED_ADMIN_PASSWORD` ถ้ามี)

ถ้าไม่มี Shell: สร้าง admin ผ่าน SQL ใน Render PostgreSQL tab **Connect** → ใช้ client รัน SQL ที่ insert ลงตาราง `agents` (ต้อง hash password ด้วย bcrypt ก่อน)

---

## ขั้นที่ 8: ทดสอบการใช้งาน

1. เปิด URL ของ **Frontend** ในเบราว์เซอร์
2. Login ด้วย `admin` / `admin123`
3. ควรเข้า Inbox ได้ (อาจยังไม่มี conversation)

**หมายเหตุ:** ล็อกอินใช้ **API** เท่านั้น (ไม่ใช้ Worker) — Worker ล้มไม่ทำให้ล็อกอินไม่ได้โดยตรง

**ถ้า Login แล้วได้ 404 หรือ Console แจ้ง Failed to load resource 404 สำหรับ `api/auth/me` / `api/auth/login`:**
- Frontend กำลังเรียก API ไปที่ origin ตัวเอง (Next.js) แทนที่จะไปที่ Backend API
- **สาเหตุ:** ตัวแปร `NEXT_PUBLIC_API_URL` บน **Frontend** ไม่ได้ตั้ง หรือตั้งแล้วแต่ไม่ได้ redeploy (Next.js ใส่ค่าตัวแปรนี้ลงใน build ตอน build time)
- **แก้:** ไปที่ **Frontend** service (unified-line-inbox) → **Environment** → ตั้ง `NEXT_PUBLIC_API_URL` = **URL สาธารณะของ API** (เช่น `https://unified-line-oa-inbox.onrender.com` ตามชื่อ API service ของคุณ) ไม่ใส่ slash ท้าย
- **แก้:** ตั้ง `NEXT_PUBLIC_API_URL` หรือ `API_URL` = URL สาธารณะของ API ที่ Frontend → Environment แล้ว Save (Frontend อ่านค่าตอน runtime จาก `/api/config` แล้ว redeploy Frontend หนึ่งครั้ง)

**ถ้ากด Sign in แล้วเหมือนจะเข้าได้แต่เด้งกลับมา login (Console เห็น 401 ที่ `api/auth/me`):**
- **สาเหตุ:** Frontend กับ API อยู่คนละโดเมน — บางเบราว์เซอร์อาจไม่ส่ง session cookie ข้ามโดเมน (third-party cookie blocking)
- **วิธีที่ 1 (Cookie):** ไปที่ **API** → **Environment** → ตั้ง `FRONTEND_URL` = URL จริงของ Frontend (เช่น `https://unified-line-inbox.onrender.com`) แล้ว Save แล้ว redeploy API
- **วิธีที่ 2 (Bearer token):** โค้ดล่าสุดรองรับการล็อกอินแบบ **Bearer token** แล้ว — หลังล็อกอิน API ส่ง `accessToken` กลับมา Frontend เก็บใน sessionStorage และส่งในหัวข้อ `Authorization: Bearer <token>` ทุกครั้งที่เรียก API ดังนั้นแม้ cookie จะไม่ส่ง ล็อกอินก็ยังทำงานได้ ให้ push โค้ดล่าสุดและ redeploy ทั้ง API และ Frontend

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
- **NEXT_PUBLIC_API_URL (Frontend)**: ต้องใช้ **Public URL** ของ API (เช่น `https://unified-line-oa-inbox.onrender.com`) เพราะ browser เรียกจากอินเทอร์เน็ต ไม่ใช่จาก private network ของ Render — อย่าใช้ Internal address จาก Connect
- **Connect → Internal** (เช่น `unified-line-oa-inbox:10000`): ใช้เมื่อ **service อื่นบน Render** (Worker, Web Service อีกตัว) ต้องการเรียก API นี้ผ่าน [Private Network](https://render.com/docs/private-network)
- **Redis (Upstash)**: Free tier มี limit การเรียกใช้ ตรวจได้ที่ Upstash dashboard
- **Session / Cookie**: ถ้า Frontend กับ API คนละ domain ต้องตั้ง `FRONTEND_URL` ที่ API เพื่อให้ CORS อนุญาต origin นั้น และให้ API ตั้ง session cookie แบบ `sameSite: none` เพื่อให้ browser ส่ง cookie ข้ามโดเมนได้

ถ้าต้องการให้ช่วยออกแบบ “หน้าเพิ่ม OA” หรือ script encrypt token ให้บอกได้ครับ
