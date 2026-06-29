const { SlashCommandBuilder } = require('discord.js');
const voice = require('@discordjs/voice');
const https = require('https');
const fs = require('fs');
const path = require('path');

const activeSessions = new Map();
const messageQueue = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tts-live')
        .setDescription('Start Live TTS')
        .addSubcommand(sub => sub.setName('start').setDescription('Start TTS').addStringOption(opt => opt.setName('language').setDescription('Language').addChoices({ name: 'English', value: 'en' }, { name: 'Hindi', value: 'hi' })))
        .addSubcommand(sub => sub.setName('stop').setDescription('Stop TTS')),

    async execute(interaction) {
        await interaction.deferReply();
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'start') {
            const channel = interaction.member.voice.channel;
            if (!channel) return interaction.editReply('❌ Join a voice channel!');
            
            try {
                const connection = voice.joinVoiceChannel({
                    channelId: channel.id,
                    guildId: guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });

                await voice.entersState(connection, voice.VoiceConnectionStatus.Ready, 30000);
                const player = voice.createAudioPlayer();
                connection.subscribe(player);
                
                activeSessions.set(guildId, { connection, player, language: interaction.options.getString('language') || 'en', channelId: interaction.channel.id, isPlaying: false });
                messageQueue.set(guildId, []);
                
                this.setupMessageListener(interaction.client, guildId);
                await interaction.editReply('✅ TTS Live Started! Type `!tts <text>`');
            } catch (err) {
                console.error(err);
                await interaction.editReply('❌ Failed to connect. Check permissions!');
            }
        } else {
            const session = activeSessions.get(guildId);
            if (session) session.connection.destroy();
            activeSessions.delete(guildId);
            await interaction.editReply('🛑 TTS Stopped.');
        }
    },

    setupMessageListener(client, guildId) {
        const handler = async (msg) => {
            const session = activeSessions.get(guildId);
            if (!session || msg.author.bot || msg.channel.id !== session.channelId || !msg.content.startsWith('!tts ')) return;
            
            const text = msg.content.slice(5).trim();
            if (!text) return;

            messageQueue.get(guildId).push({ text, language: session.language });
            if (!session.isPlaying) this.processQueue(guildId);
        };
        client.on('messageCreate', handler);
    },

    async processQueue(guildId) {
        const session = activeSessions.get(guildId);
        const queue = messageQueue.get(guildId);
        if (!session || !queue || queue.length === 0) return (session && (session.isPlaying = false));

        session.isPlaying = true;
        const item = queue.shift();
        const tempFile = path.join(__dirname, `tts_${Date.now()}.mp3`);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${item.language}&client=tw-ob&q=${encodeURIComponent(item.text)}`;

        try {
            await this.downloadFile(ttsUrl, tempFile);
            const resource = voice.createAudioResource(tempFile);
            session.player.play(resource);
            
            session.player.once(voice.AudioPlayerStatus.Idle, () => {
                try { fs.unlinkSync(tempFile); } catch (e) {}
                this.processQueue(guildId);
            });
        } catch (e) {
            session.isPlaying = false;
            this.processQueue(guildId);
        }
    },

    downloadFile(url, dest) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                res.pipe(file);
                file.on('finish', resolve);
            }).on('error', reject);
        });
    }
};
