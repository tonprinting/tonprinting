@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo [ERROR] ยังไม่ได้ติดตั้ง Node.js & pause & exit /b 1)
if not exist data mkdir data
call npm install
cls
echo ========================================
echo SBUYPRINT SERVER
 echo ========================================
echo Web   : http://localhost:3000
echo Admin : http://localhost:3000/admin
echo Health: http://localhost:3000/health
echo ========================================
echo หากยังไม่ได้ใส่ Supabase ระบบจะใช้ Local Storage อัตโนมัติ
echo ห้ามปิดหน้าต่างนี้
node server.js
pause
