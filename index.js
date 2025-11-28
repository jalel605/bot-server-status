const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Gamedig = require('gamedig');
const http = require('http'); // مكتبة لإبقاء الخدمة تعمل في Render
require('dotenv').config();

// Load environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SERVER_IP = process.env.SERVER_IP; // مثال: "57.129.66.21:27015"
// متغير البيئة لتحديد الدولة
const SERVER_COUNTRY = process.env.SERVER_COUNTRY || 'Unknown'; 

if (!BOT_TOKEN || !CHANNEL_ID || !SERVER_IP) {
    console.error("Missing environment variables (BOT_TOKEN, CHANNEL_ID, SERVER_IP)");
    process.exit(1);
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

let messageId = null; // لتخزين معرف الرسالة الواحدة التي سيتم تحديثها

// دالة تحويل رمز الدولة إلى علم ونص
const getCountryFlag = (countryCode) => {
    const flags = {
        'RO': '🇷🇴 Romania',
        'GR': '🇬🇷 Greece', 
        'US': '🇺🇸 USA',
        'GB': '🇬🇧 UK',
        'DE': '🇩🇪 Germany' 
    };
    return flags[countryCode.toUpperCase()] || '🌍 Unknown Location';
};

async function updateServerStatus() {
    console.log(`Checking server status for ${SERVER_IP}...`);
    try {
        const [ip, port] = SERVER_IP.split(':');
        const state = await Gamedig.query({
            type: 'cs16', // يمكنك تغيير نوع اللعبة إذا لزم الأمر
            host: ip,
            port: parseInt(port)
        });

        const countryInfo = getCountryFlag(SERVER_COUNTRY);

        const embed = new EmbedBuilder()
            .setColor(state.maxplayers > state.players.length ? 0x00FF00 : 0xFF0000)
            .setTitle(state.name)
            .setURL(`steam://connect/${SERVER_IP}`)
            .setDescription(`**Connect:** \`steam://connect/${SERVER_IP}\``)
            .addFields(
                { name: 'Status', value: state.maxplayers > 0 ? '🟢 Online' : '🔴 Offline', inline: true },
                { name: 'Country', value: countryInfo, inline: true }, 
                { name: 'Address:Port', value: `\`${SERVER_IP}\``, inline: false },
                { name: 'Game', value: state.raw.game || 'Counter-Strike 1.6', inline: true },
                { name: 'Current Map', value: state.map, inline: true },
                { name: 'Players', value: `${state.players.length} / ${state.maxplayers} (${Math.round((state.players.length / state.maxplayers) * 100)}%)`, inline: false },
            )
            .setTimestamp()
            .setFooter({ text: `Last Update: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}` });
        
        // منطق تحديث الرسالة الواحدة
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) {
            console.error("Channel not found. Check CHANNEL_ID.");
            return;
        }

        if (messageId) {
            try {
                const message = await channel.messages.fetch(messageId);
                // تحقق من أن محتوى التضمين (Embed) قد تغير قبل التعديل (لتحسين الأداء)
                await message.edit({ embeds: [embed] });
                console.log(`Successfully edited message: ${messageId}`);
            } catch (error) {
                console.warn(`Could not find message ID ${messageId} or failed to edit. Sending a new message.`);
                const newMessage = await channel.send({ embeds: [embed] });
                messageId = newMessage.id;
                console.log(`Sent new message and updated messageId: ${messageId}`);
            }
        } else {
            // أول تشغيل، أرسل رسالة جديدة
            const newMessage = await channel.send({ embeds: [embed] });
            messageId = newMessage.id;
            console.log(`Sent initial message and saved ID: ${messageId}`);
        }

    } catch (error) {
        // إذا كان السيرفر متوقفاً
        const embed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('Server Status Monitor')
            .setDescription(`🔴 **Server is Offline or Unreachable**\n\n**IP:** \`${SERVER_IP}\``)
            .setTimestamp()
            .setFooter({ text: `Last checked: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}` });

        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel) {
            if (messageId) {
                try {
                    const message = await channel.messages.fetch(messageId);
                    await message.edit({ embeds: [embed] });
                    console.log(`Successfully edited message (Offline): ${messageId}`);
                } catch (editError) {
                    const newMessage = await channel.send({ embeds: [embed] });
                    messageId = newMessage.id;
                }
            } else {
                const newMessage = await channel.send({ embeds: [embed] });
                messageId = newMessage.id;
            }
        }
        console.error(`Error querying server ${SERVER_IP}: ${error.message}`);
    }
}

client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}!`);
    updateServerStatus();
    setInterval(updateServerStatus, 20000); 
});

client.login(BOT_TOKEN).catch(err => {
    console.error(`Failed to log in to Discord. Check your BOT_TOKEN: ${err.message}`);
    process.exit(1);
});

// =========================================================
// 🌐 خانة المنفذ (PORT) لمنع الإغلاق التلقائي في Render
// =========================================================
const PORT = process.env.PORT || 10000; // يستخدم متغير البيئة PORT الذي يوفره Render

const server = http.createServer((req, res) => {
    // يمكنك رؤية هذه الرسالة إذا دخلت على رابط Render للخدمة
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running and monitoring the server status.\n');
});

server.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});