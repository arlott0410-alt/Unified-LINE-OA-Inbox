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

4. **Environment Variables** — ใช้ค่าเดียวกับ API:
   - `DATABASE_URL` = ค่าเดียวกับ API
   - `REDIS_URL` = ค่าเดียวกับ API

5. **Create Background Worker**
6. รอ deploy จน Worker ขึ้นสถานะ Running

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
   - **Key**: `NEXT_PUBLIC_API_URL`  
   - **Value**: URL ของ API จากขั้นที่ 3 (เช่น `https://unified-line-inbox-api.onrender.com`)  
   - ไม่ใส่ slash ท้าย URL

5. **Create Web Service**
6. รอ deploy แล้ว copy URL ของ Frontend (เช่น `https://unified-line-inbox.onrender.com`)

---

## ขั้นที่ 6: กลับไปตั้งค่า CORS ที่ API

1. ไปที่ Web Service ของ **API** (unified-line-inbox-api)
2. **Environment** → แก้ `FRONTEND_URL` ให้เป็น URL จริงของ Frontend  
   - ตัวอย่าง: `https://unified-line-inbox.onrender.com`
3. Save → Render จะ redeploy API ให้เอง

---

## ขั้นที่ 7: สร้าง Admin คนแรก (Seed)

1. ไปที่ API service → **Shell** (หรือใช้ Render Shell ถ้ามี)
2. รันคำสั่ง (ใน container ของ API):

   ```bash
   npx prisma db seed
   ```

   หรือถ้า Render ไม่เปิด Shell ให้ใช้ **One-off Job** (ถ้ามี):
   - New → Background Worker ชั่วคราว หรือใช้คำสั่ง release/start ที่รัน seed ครั้งเดียว

3. หลัง seed สำเร็จ จะมี admin:
   - **Name**: `admin`
   - **Password**: `admin123`  
   (หรือตามที่ตั้งใน `SEED_ADMIN_NAME` / `SEED_ADMIN_PASSWORD` ถ้ามี)

ถ้าไม่มี Shell: สร้าง admin ผ่าน SQL ใน Render PostgreSQL tab **Connect** → ใช้ client รัน SQL ที่ insert ลงตาราง `agents` (ต้อง hash password ด้วย bcrypt ก่อน)

---

## ขั้นที่ 8: ทดสอบการใช้งาน

1. เปิด URL ของ **Frontend** ในเบราว์เซอร์
2. Login ด้วย `admin` / `admin123`
3. ควรเข้า Inbox ได้ (อาจยังไม่มี conversation)

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

## หมายเหตุสำคัญ

- **Free tier**: Web Service จะ sleep เมื่อไม่มี traffic; request แรกอาจช้า
- **DATABASE_URL**: ใช้ Internal URL ถ้า DB กับ Service อยู่กลุ่มเดียวกัน จะเร็วกว่า
- **Redis (Upstash)**: Free tier มี limit การเรียกใช้ ตรวจได้ที่ Upstash dashboard
- **Session / Cookie**: ถ้า Frontend กับ API คนละ domain ต้องตั้ง CORS และ cookie same-site ตามที่เหมาะสม (ตอนนี้ตั้ง `FRONTEND_URL` ไว้แล้ว)

ถ้าต้องการให้ช่วยออกแบบ “หน้าเพิ่ม OA” หรือ script encrypt token ให้บอกได้ครับ
