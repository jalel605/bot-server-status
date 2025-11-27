// index.js
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Gamedig = require('gamedig');
require('dotenv').config();

// --- 1. إعدادات البوت والخدمة ---
const BOT_TOKEN = process.env.BOT_TOKEN; // يجب إضافة هذا المتغير في Render
const CHANNEL_ID = process.env.CHANNEL_ID; // يجب إضافة هذا المتغير في Render
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT;
const GAME_TYPE = 'cs16'; 
const POLLING_INTERVAL = 20000; // 20 ثانية

// --- 2. متغيرات الحالة والتتبع ---
// تهيئة Discord Client مع الإذونات الأساسية
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let monitorMessage = null; // لتخزين كائن الرسالة التي سيتم تعديلها
let lastMap = null; 
let lastServerFullStatus = false; 
let lastPlayersHash = ''; // لتتبع قائمة اللاعبين


// --- 3. دالة بناء رسالة Embed ---
function createStatusEmbed(state, isOffline = false) {
    const color = isOffline ? 0xFF0000 : 0x00FF00; 
    
    // بناء قائمة اللاعبين بشكل صحيح
    const playerList = isOffline ? 'N/A' : (state.players.map(p => p.name || 'N/A').join('\n') || 'No players online.');

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(isOffline ? `🚨 Server Offline 🚨` : `🔥 ${state.name}`)
        .setDescription(`**Connect:** steam://connect/${SERVER_IP}:${SERVER_PORT}`)
        .addFields(
            { name: 'Status', value: isOffline ? '🔴 Offline' : '🟢 Online', inline: true },
            { name: 'Address:Port', value: `${SERVER_IP}:${SERVER_PORT}`, inline: true },
            { name: 'Current Map', value: isOffline ? 'N/A' : state.map, inline: true },
            { name: 'Players', value: isOffline ? '0 / 0' : `${state.players.length} / ${state.maxplayers}`, inline: true },
            { name: 'Player List', value: playerList, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Game Server Monitor | Last Update' });
        
    return embed;
}

// --- 4. دالة مراقبة حالة السيرفر الرئيسية ---
async function updateServerStatus() {
    let currentState = null;
    let isOffline = false;

    // 4.1 الاستعلام عن السيرفر
    try {
        currentState = await Gamedig.query({ type: GAME_TYPE, host: SERVER_IP, port: SERVER_PORT });
    } catch (error) {
        isOffline = true;
    }
    
    // 4.2 منطق التحديث المشروط
    let shouldUpdate = false;
    
    if (!isOffline) {
        const currentMap = currentState.map;
        const maxPlayers = currentState.maxplayers;
        const isCurrentlyFull = (currentState.players.length >= maxPlayers);
        
        // Hash قائمة اللاعبين لتتبع التغييرات الصغيرة في اللاعبين
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

    // إذا لم يكن هناك تحديث مطلوب، لا تفعل شيئاً (يمنع الـ Spam)
    if (!shouldUpdate && monitorMessage) {
        console.log("No state change. Skipping edit.");
        return;
    }
    
    // 4.3 بناء الـ Embed
    const statusEmbed = createStatusEmbed(currentState, isOffline);

    // 4.4 إرسال/تعديل الرسالة باستخدام دالة edit()
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