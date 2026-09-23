# SBUYPRINT Offline + Supabase Ready

## เปิดใช้งานบน Windows
1. ติดตั้ง Node.js LTS
2. แตก ZIP
3. ดับเบิลคลิก `start.bat`
4. เปิด Chrome ที่ http://localhost:3000
5. Admin: http://localhost:3000/admin
6. Login: admin / ChangeMe123!

## จุดสำคัญ
- ถ้ายังไม่ได้ตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ระบบจะใช้ Local Storage (`data/store.json`) อัตโนมัติ จึงเปิดเว็บและเพิ่ม/แก้ไขสินค้าได้แบบออฟไลน์
- ถ้าตั้ง Supabase ที่ถูกต้อง ระบบจะใช้ Supabase อัตโนมัติ
- SUPABASE_URL ต้องเป็น URL เต็ม เช่น https://xxxxx.supabase.co ไม่ใช่ `/rest/v1/products`
- ตรวจ Server: http://localhost:3000/health
