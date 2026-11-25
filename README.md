# Lilly Training

แอปบันทึกการออกกำลังกายส่วนตัว ใช้ได้ทั้งบนมือถือและคอม (PWA) บันทึกเวทรายเครื่อง คาร์ดิโอ และผลวัดร่างกาย

เว็บ: https://thanachokkusol.github.io/lilly-training/

## ใช้งาน

- **วันนี้**: เลือกโปรแกรม (เช่น WE · Upper Body) แล้วได้รายการเครื่องของวันนี้ แตะแต่ละเครื่องเพื่อดูรูป วิธีเล่น การตั้งเครื่อง ผลครั้งก่อนพร้อมวันที่ สถิติสูงสุด และกรอกเซต มีปุ่มก่อนหน้า/ท่าถัดไป และจับเวลาพัก
- **เครื่องและท่า**: แตะเครื่อง แล้วกด "เริ่มฝึกท่านี้" ก็ถึงหน้ากรอกเซต (2 แตะ) ถ้ามีการฝึกที่ค้างอยู่วันนี้ เครื่องนั้นจะถูกเพิ่มเข้าการฝึกเดิม ไม่แยกเป็นอีกรายการ หน้าเครื่องมีประวัติทุกครั้งที่เล่น ถ่ายหรือเลือกรูป ตั้งรูปหลัก แก้ไข ซ่อน หรือลบเครื่องได้ (ลบแล้วเข้าถังขยะ)
- **น้ำหนักแบบข้อความ**: ค่าอย่าง "13.5 กก. + 10 ที่หมุน" เก็บตามต้นฉบับ ไม่แปลงรวมเป็นตัวเลขเดียว
- **ครั้งก่อน vs สถิติสูงสุด**: แสดงแยกกันเสมอ ครั้งก่อนเรียงตามวันที่ สถิติสูงสุดไม่ทับค่าครั้งล่าสุด (เครื่องแรงช่วย ยิ่งน้อยยิ่งดี)
- **คาร์ดิโอ**: วันที่เล่นจริงแยกจากรอบสัปดาห์ที่นับ (รองรับเดินชดเชย) รอบอาทิตย์–เสาร์ ตามเวลาไทย เป้าตั้งต้น 150 นาที แนบรูปหน้าจอเครื่อง แล้วอ่านตัวเลขด้วย OCR ในเบราว์เซอร์ ต้องตรวจค่าก่อนบันทึก
- **รายงานเทรนเนอร์**: สร้างข้อความคาร์ดิโอของวันนั้น ยอดสะสมของรอบ % และเวลาที่เกิน/เหลือ พร้อมสรุปท่าเวท (น้ำหนัก × ครั้ง) และยืดเหยียด กดคัดลอกแล้วส่งเอง
- **วางรูป**: เปิดฟอร์มคาร์ดิโอ ผลวัด หรือหน้าเครื่อง แล้ววางรูปที่คัดลอกไว้ (Ctrl+V) เป็นหลักฐานหรือรูปเครื่องได้ ไม่ต้องเลือกไฟล์
- **ความก้าวหน้า**: น้ำหนัก รอบเอว ไขมัน มวลกล้ามเนื้อ กราฟรายเครื่อง และคาร์ดิโอ 8 สัปดาห์
- **ประวัติ**: กรองเวท/คาร์ดิโอ/ผลวัด และกรองเวทตามฟิตเนส (WE Fitness / Jett)
- **ตั้งค่า**: ซิงก์ เป้าหมาย โปรแกรมฝึก สำรองข้อมูล (ZIP พร้อมรูป / CSV) ถังขยะกู้คืนได้ และคลังข้อมูลเดิม

ช่องที่ไม่รู้ค่าให้เว้นว่าง แอปไม่เติม 0 หรือจำนวนเซตที่ไม่ได้บันทึก ผลที่ลงวันที่ในอนาคตจะไม่ถูกนับเป็นผลจริง

## ติดตั้งบนมือถือ

- **iPhone (Safari)**: เปิดเว็บ > ปุ่มแชร์ > "เพิ่มไปยังหน้าจอโฮม"
- **Android (Chrome)**: เปิดเว็บ > เมนู ⋮ > "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"

เปิดจากไอคอนแล้วเข้าสู่ระบบด้วยชื่อผู้ใช้หรืออีเมล ข้อมูลซิงก์อัตโนมัติขณะออนไลน์ และบันทึกในเครื่องได้แม้ออฟไลน์

## บัญชี โค้ช และเพื่อน

| บัญชี | สร้างโดย | เห็นอะไร |
|---|---|---|
| เจ้าของ (ไวท์) | ตั้งครั้งแรกใน Supabase | บันทึกของตัวเอง + ข้อมูลกองกลาง · จัดการบัญชีและรหัสเชิญ |
| โค้ช | เจ้าของสร้างใน Settings → บัญชี | บันทึกของตัวเอง + ข้อมูลกองกลาง + บันทึกของลูกเทรนที่เลือกโค้ชคนนี้ (ดูอย่างเดียว) |
| เพื่อน | สมัครเองได้ที่หน้าเข้าสู่ระบบ (ขณะเปิดรับสมัคร) หรือเจ้าของสร้างให้ | บันทึกของตัวเอง + ข้อมูลกองกลาง |

- **ข้อมูลกองกลาง**: เครื่อง รูปเครื่อง โปรแกรม และรายชื่อยิม ทุกบัญชีเห็นและแก้ได้
- **ข้อมูลส่วนตัว**: เวท คาร์ดิโอ ผลวัด ยืดเหยียด และรูปหลักฐาน เห็นเฉพาะเจ้าของบันทึก และโค้ชที่เจ้าของบันทึกเลือกเอง เจ้าของสมุดไม่มีสิทธิ์พิเศษในการดูบันทึกของเพื่อน
- **เลือกโค้ช**: Settings → โค้ชของฉัน → ติ๊ก "ฉันเป็นลูกเทรนของโค้ช …" (เอาออกได้ทุกเมื่อ)
- **โค้ชดูลูกเทรน**: ตัวเลือก "กำลังดู" ด้านบน หรือ Settings → ลูกเทรนของฉัน → ดูข้อมูล จะขึ้นแถบ "กำลังดูข้อมูลของ ลูกเทรน … · ดูอย่างเดียว" และซ่อนปุ่มบันทึก · การ์ดลูกเทรนสรุปคาร์ดิโอเทียบเป้า เวท ยืดเหยียด บันทึกล่าสุด และน้ำหนักล่าสุด
- **สมัครเอง**: เจ้าของเปิด/ปิดที่ Settings → การสมัครสมาชิก ระหว่างเปิด ใครมีลิงก์เว็บก็กด เข้าสู่ระบบ → สมัครสมาชิก ได้ (ไม่ต้องใช้รหัสเชิญ จำกัด 20 บัญชีต่อชั่วโมง) · บัญชีที่สมัครเองเป็น "เพื่อน" เสมอ · สมัครครบแล้วปิดได้
- **สลับบัญชีในเครื่องเดียว**: ออกจากระบบแล้วเข้าบัญชีอื่นได้เลย แอปล้างสำเนาของบัญชีเก่าในเครื่องให้ (ข้อมูลยังอยู่บนคลาวด์) ยกเว้นมีรายการรอซิงก์ จะให้กลับไปซิงก์บัญชีเดิมก่อน
- **ลืมรหัสผ่าน**: ไม่มีอีเมล เจ้าของตั้งรหัสใหม่ให้ใน Settings → บัญชี · ทุกคนเปลี่ยนรหัสของตัวเองได้ (ต้องใส่รหัสเดิม)

## Supabase (ซิงก์มือถือกับคอม)

1. SQL Editor: รัน `supabase/schema.sql` (เปิด RLS ทุกตาราง ตารางเขียนตรงไม่ได้ ต้องผ่านฟังก์ชันที่ตรวจเจ้าของและ revision)
2. Authentication > Sign In / Providers: ปิด "Allow new users to sign up"
3. Authentication > Users: สร้างผู้ใช้เจ้าของ (ตั้งรหัสผ่านเอง) แล้วรัน
   `insert into public.training_owners(user_id) values ('UUID-ของผู้ใช้');`
4. GitHub repo > Settings > Secrets and variables > Actions > **Variables**: ตั้ง `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` (Publishable key เท่านั้น build จะปฏิเสธ secret/service_role key)
5. Edge Functions: deploy `supabase/functions/trainer-admin` และ `supabase/functions/member-signup` โดยปิด "Verify JWT" ทั้งสองตัว (ฟังก์ชันตรวจสิทธิ์เองข้างใน) · secret key อยู่ใน environment ของ Supabase เท่านั้น ไม่อยู่ในเว็บ

## โหลดข้อมูลตั้งต้นครั้งแรก

แอปบนเว็บไม่มีปุ่มนำเข้า ข้อมูลเดิม (`private/initial-backup.zip`) โหลดครั้งเดียวจากคอมเครื่องนี้:

1. สร้าง `.env.local` (ไม่ถูก commit) ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY`
2. `npm run dev` เปิด http://127.0.0.1:5173 เข้าสู่ระบบบัญชีเจ้าของ
3. ตั้งค่า > "เลือก ZIP ข้อมูลตั้งต้น (เฉพาะโหมดพัฒนา)" > เลือกไฟล์ ZIP จากเครื่อง > ตรวจรายการ > ยืนยัน แล้วรอซิงก์จนรายการรอซิงก์เป็น 0

รายการที่มีรหัสอยู่แล้วจะถูกข้าม และถ้าข้อมูลชุดเดียวกันอยู่บนออนไลน์แล้ว ระบบถือว่าเป็นรายการเดียวกัน ยอดจึงไม่เบิ้ล ตัวเลือกไฟล์มีเฉพาะโหมดพัฒนา และ dev server ปิดการเสิร์ฟไฟล์จากโฟลเดอร์ `private/`

## พัฒนาและตรวจงาน

```powershell
npm ci
npm test        # คำนวณยอด/รอบชดเชย, รายงานโค้ช, ประวัติ/สถิติสูงสุด, validation, ขั้นตอนฝึก, RLS ด้วย PostgreSQL ในเครื่อง
npm run build   # ตรวจว่าไม่มี secret key แล้ว build ลง dist
npm audit
```

- `?sandbox=1` ใช้ฐานข้อมูลทดสอบแยกจากข้อมูลจริง และไม่เชื่อม Supabase
- push ขึ้น `main` แล้ว GitHub Actions จะรันเทสต์ build และเผยแพร่ Pages เอง
- `Open-Lilly.cmd` เปิดไฟล์ build ในคอมนี้ที่ http://127.0.0.1:5173

## ความปลอดภัย

- โฟลเดอร์ `private/`, `.env*` และ `dist/` อยู่ใน `.gitignore` ข้อมูลส่วนตัวและรูปอยู่ใน IndexedDB ของเครื่องและ Supabase (RLS แยกตามผู้ใช้, bucket รูปเป็น private) ไม่อยู่ใน repo
- ตารางทุกตารางเขียนตรงผ่าน API ไม่ได้ ต้องผ่านฟังก์ชันที่ตรวจสิทธิ์ · โค้ชอ่านบันทึกของลูกเทรนได้แต่เขียนไม่ได้ · บัญชีที่ถูกปิดหรือถูกเอาโค้ชออกหมดสิทธิ์ทันที (มีเทสต์ RLS ใน `src/schema.test.ts`)
- build มีเฉพาะ Project URL และ Publishable key ซึ่งเปิดเผยได้ สิทธิ์จริงคุมด้วย RLS
- Content Security Policy อนุญาตเฉพาะ Supabase, Google Fonts และแพ็กเกจ Tesseract ที่ล็อกเวอร์ชันบน jsdelivr
- โค้ดโหลด Supabase, jszip และกราฟเมื่อใช้งานจริงเท่านั้น

## Exercise image credits

- Wall Chest Stretch (Elbow) uses the one-arm illustration from [Open Exercise Illustrations](https://github.com/MarvinNazari/exercise-images), CC0 1.0. Resized and converted to JPEG.

- Kettlebell Swing illustrations by [Marvin Nazari](https://github.com/MarvinNazari/exercise-images), CC0 1.0. Resized and converted to JPEG.
- Kettlebell Upright Row photo by [Tyler Read / PT Pioneer](https://www.ptpioneer.com/), from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Upright_row_with_kettle_bell.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). Resized for the app.
- Forward Lunge illustrations by [RepDB](https://repdb.co), from its free exercise dataset. Converted to JPEG.
- Doorway Chest Stretch and Wall Chest Stretch (Straight Arm) are original illustrations drawn for this app.
- Stiff-Legged Dumbbell Deadlift and the leg, glute, calf and back stretch photos from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (Unlicense).
- Concentration Curl, Reverse Curl, Lying Dumbbell Triceps Extension, and Crunch photos from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db). Side-Lying Hip Abduction illustrations by [Marvin Nazari](https://github.com/MarvinNazari/exercise-images), CC0 1.0, resized and converted to JPEG.
