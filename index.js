// index.js (النسخة النهائية مع التعديل)
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Gamedig = require('gamedig');
require('dotenv').config();

// --- 1. إعدادات البوت والخدمة ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; 
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const GAME_TYPE = 'cs16'; 
const POLLING_INTERVAL = 20000; // 20 ثانية

// --- 2. متغيرات الحالة والتتبع ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let monitorMessage = null; // لتخزين كائن الرسالة التي سيتم تعديلها
let lastMap = null; 
let lastServerFullStatus = false; 
let lastPlayersHash = ''; // لتتبع قائمة اللاعبين (للتحديث الاحترافي)


// --- 3. دالة بناء رسالة Embed (تبقى كما هي تقريباً) ---
function createStatusEmbed(state, isOffline = false) {
    // ... (نفس منطق بناء الـ Embed السابق) ...
    // ... (تأكد من إضافة حقل Players وقائمة اللاعبين)
    // ...
    // (لتوفير المساحة، لن أدرج الكود الكامل هنا، لكنه يستخدم EmbedBuilder)
    
    // مثال بسيط للـ Embed
    const embed = new EmbedBuilder()
        .setColor(isOffline ? 0xFF0000 : 0x00FF00)
        .setTitle(isOffline ? `🚨 Server Offline 🚨` : `🔥 ${state.name}`)
        .setDescription(`**Connect:** steam://connect/${SERVER_IP}:${SERVER_PORT}`)
        .addFields(
            { name: 'Status', value: isOffline ? '🔴 Offline' : '🟢 Online', inline: true },
            { name: 'Current Map', value: isOffline ? 'N/A' : state.map, inline: true },
            { name: 'Players', value: isOffline ? '0 / 0' : `${state.players.length} / ${state.maxplayers}`, inline: true },
        )
        .setTimestamp();
        
    return embed;
}

// --- 4. دالة مراقبة حالة السيرفر الرئيسية ---
async function updateServerStatus() {
    let currentState = null;
    let isOffline = false;

    try {
        currentState = await Gamedig.query({ type: GAME_TYPE, host: SERVER_IP, port: SERVER_PORT });
    } catch (error) {
        isOffline = true;
    }
    
    // 4.1 منطق التحديث المشروط
    let shouldUpdate = false;
    if (!isOffline) {
        const currentMap = currentState.map;
        const maxPlayers = currentState.maxplayers;
        const isCurrentlyFull = (currentState.players.length >= maxPlayers);
        
        // إنشاء قيمة Hash لقائمة اللاعبين (لتتبع التغييرات الصغيرة)
        const playersHash = currentState.players.map(p => p.name).sort().join('|');

        // شروط التحديث:
        const mapChanged = currentMap !== lastMap;
        const fullStatusChanged = lastServerFullStatus !== isCurrentlyFull;
        const playerListChanged = playersHash !== lastPlayersHash;

        shouldUpdate = mapChanged || fullStatusChanged || playerListChanged;

        // تحديث المتغيرات للحالة الجديدة
        lastMap = currentMap;
        lastServerFullStatus = isCurrentlyFull;
        lastPlayersHash = playersHash;
    } else {
        // دائماً نحدث إذا كان السيرفر Offline
        shouldUpdate = true;
    }

    if (!shouldUpdate && monitorMessage) {
        console.log("No state change. Skipping edit.");
        return;
    }
    
    // 4.2 بناء الـ Embed
    const statusEmbed = createStatusEmbed(currentState, isOffline);

    // 4.3 إرسال/تعديل الرسالة
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        
        if (monitorMessage) {
            // التعديل المباشر على الرسالة (الرسالة المتجددة)
            await monitorMessage.edit({ embeds: [statusEmbed] });
            console.log('Message edited successfully.');
        } else {
            // إذا كانت أول مرة، أرسل رسالة جديدة واحفظ كائنها
            monitorMessage = await channel.send({ embeds: [statusEmbed] });
            console.log('Message sent for the first time and stored.');
        }

    } catch (error) {
        console.error('Error sending/editing message:', error.message);
    }
}

// --- 5. تشغيل البوت والجدولة ---
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // تشغيل التحديث الفوري عند التشغيل
    updateServerStatus(); 
    
    // جدولة التحديث الدوري
    setInterval(updateServerStatus, POLLING_INTERVAL);
});

client.login(BOT_TOKEN);