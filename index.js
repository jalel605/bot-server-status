// index.js
const Gamedig = require('gamedig');
const axios = require('axios');
require('dotenv').config();

// --- 1. المتغيرات الأساسية ---
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; 
const GAME_TYPE = 'cs16'; 

// --- 2. متغيرات حالة التتبع (للتحديث المشروط) ---
let lastMap = null; 
let lastServerFullStatus = false; 
let lastMessageId = null; // لحفظ ID الرسالة المرسلة لحذفها لاحقاً

// --- 3. دالة بناء حمولة الرسالة (Embed) ---
function createStatusPayload(state, isOffline = false) {
    // الألوان: أحمر (Offline)، أخضر (Online)
    const color = isOffline ? 0xFF0000 : 0x00FF00; 

    const embed = {
        color: color,
        title: isOffline ? `🚨 Server Offline 🚨` : `🔥 ${state.name}`,
        description: `**Connect:** steam://connect/${SERVER_IP}:${SERVER_PORT}`,
        fields: [
            { name: 'Status', value: isOffline ? '🔴 Offline' : '🟢 Online', inline: true },
            { name: 'Address:Port', value: `${SERVER_IP}:${SERVER_PORT}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'System Powered by GlaD | Last Update'
        }
    };

    if (!isOffline) {
        // إضافة تفاصيل السيرفر إذا كان Online
        embed.fields.push(
            { name: 'Current Map', value: state.map, inline: true },
            { name: 'Players', value: `${state.players.length} / ${state.maxplayers}`, inline: true },
        );
        
        // بناء قائمة اللاعبين
        const playerList = state.players.map(p => p.name || 'N/A').join('\n') || 'No players online.';
        embed.fields.push(
            { name: 'Player List', value: playerList, inline: false }
        );
    }
    
    return {
        embeds: [embed]
    };
}

// --- 4. دالة الحذف والإرسال (التحديث) - الحل لمشكلة الحذف ---
async function sendUpdate(payload) {
    // 4.1 محاولة حذف الرسالة القديمة أولاً
    if (lastMessageId) {
        try {
            // استخدام URL Webhook الكامل + ID الرسالة للحذف (يتطلب التوكن في الرابط)
            const deleteUrl = `${WEBHOOK_URL}/messages/${lastMessageId}`;
            await axios.delete(deleteUrl);
            console.log(`Successfully deleted previous message: ${lastMessageId}`);
        } catch (error) {
            // تسجيل الخطأ ولكن عدم التوقف (لأن الرسالة قد تكون حذفت يدوياً)
            console.error('Could not delete previous message. Error status:', error.response ? error.response.status : error.message);
        }
    }
    
    // 4.2 إرسال الرسالة الجديدة
    try {
        const response = await axios.post(WEBHOOK_URL, payload);
        
        // التحقق من الاستجابة وحفظ ID الرسالة الجديدة
        if (response.data && response.data.id) {
            lastMessageId = response.data.id; // <--- حفظ الـ ID الجديد للعملية القادمة
            console.log(`Successfully sent new message. ID: ${lastMessageId}`);
        } else {
             // فشل في الحصول على الـ ID (قد يحدث إذا كانت الاستجابة غير متوقعة)
             console.error("Sent message, but failed to retrieve message ID for next deletion.");
             lastMessageId = null; 
        }

    } catch (error) {
        console.error('Failed to send Webhook message. Check your WEBHOOK_URL. Error:', error.response ? error.response.data : error.message);
    }
}


// --- 5. دالة مراقبة حالة السيرفر الرئيسية (منطق التحديث المشروط) ---
async function updateServerStatus() {
    let currentState = null;
    let isOffline = false;

    // 5.1 الاستعلام عن السيرفر
    try {
        currentState = await Gamedig.query({
            type: GAME_TYPE,
            host: SERVER_IP,
            port: SERVER_PORT
        });
    } catch (error) {
        isOffline = true;
    }

    // 5.2 منطق التحديث المشروط (تغير الخريطة أو حالة الامتلاء/عدم الامتلاء)
    if (!isOffline) {
        const currentMap = currentState.map;
        const currentPlayersCount = currentState.players.length;
        const maxPlayers = currentState.maxplayers;
        const isCurrentlyFull = (currentPlayersCount >= maxPlayers);
        
        // شروط التحديث:
        const mapChanged = currentMap !== lastMap;
        const fullStatusChanged = lastServerFullStatus !== isCurrentlyFull;

        // إذا لم يتغير شيء مهم (الخريطة أو حالة الامتلاء) لا نحدث
        if (!mapChanged && !fullStatusChanged) {
            console.log("No required changes (Map or Full Status). Skipping update.");
            return;
        }
        
        // تحديث متغيرات حالة التتبع
        lastMap = currentMap;
        lastServerFullStatus = isCurrentlyFull;
    } 
    
    // 5.3 بناء وإرسال التحديث
    const payload = createStatusPayload(currentState, isOffline);
    await sendUpdate(payload);
}

// --- 6. دالة البدء ---
function startMonitor() {
    console.log('Starting game server monitor...');
    
    // تشغيل التحديث الفوري عند البدء
    updateServerStatus(); 
    
    // تشغيل التحديث الدوري كل 20 ثانية (لتقليل الضغط)
    setInterval(updateServerStatus, 20000); 
}

startMonitor();