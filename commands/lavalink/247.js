const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const musicIcons = require('../../UI/icons/musicicons');

// Store 24/7 sessions: guildId -> { channelId, client }
const sessions = new Map();

// Called from events/music.js or index.js on voiceStateUpdate
function handle247Rejoin(client, oldState, newState) {
    const guildId = oldState.guild.id;
    const session = sessions.get(guildId);
    if (!session) return;

    // Bot was disconnected/kicked
    if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
        const channel = client.channels.cache.get(session.channelId);
        if (!channel) return;

        setTimeout(() => {
            try {
                // Rejoin via riffy if available
                if (client.riffy) {
                    const player = client.riffy.players.get(guildId);
                    if (player) {
                        player.connect();
                    } else {
                        client.riffy.createConnection({
                            guildId,
                            voiceChannel: session.channelId,
                            textChannel: session.textChannelId,
                            deaf: true,
                            mute: false,
                        });
                    }
                } else if (client.distube) {
                    // fallback: rejoin via discord.js voice
                    const { joinVoiceChannel } = require('@discordjs/voice');
                    joinVoiceChannel({
                        channelId: session.channelId,
                        guildId,
                        adapterCreator: oldState.guild.voiceAdapterCreator,
                        selfDeaf: true,
                    });
                }
            } catch (e) {
                console.error('[247] Rejoin error:', e.message);
            }
        }, 1500);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Keep the bot in a voice channel 24/7')
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Start 24/7 mode — bot stays in your current VC')
        )
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Stop 24/7 mode and disconnect the bot')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    handle247Rejoin,

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const member = interaction.member;

        if (sub === 'start') {
            const voiceChannel = member.voice?.channel;

            if (!voiceChannel) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff4444')
                            .setDescription(`${musicIcons.wrongIcon ? '' : '❌'} **You must be in a voice channel first!**`)
                            .setFooter({ text: 'Join a VC then run /247 start' })
                    ],
                    ephemeral: true
                });
            }

            if (sessions.has(guildId)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ffaa00')
                            .setDescription('⚠️ **24/7 mode is already active!**\nUse `/247 stop` to disable it first.')
                    ],
                    ephemeral: true
                });
            }

            // Store session
            sessions.set(guildId, {
                channelId: voiceChannel.id,
                textChannelId: interaction.channel.id,
            });

            // Join via riffy
            try {
                if (client.riffy) {
                    let player = client.riffy.players.get(guildId);
                    if (!player) {
                        player = await client.riffy.createConnection({
                            guildId,
                            voiceChannel: voiceChannel.id,
                            textChannel: interaction.channel.id,
                            deaf: true,
                            mute: false,
                        });
                    }
                }
            } catch (e) {
                console.error('[247] Join error:', e.message);
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#00ff88')
                        .setTitle('🔁 24/7 Mode Enabled')
                        .setDescription(`The bot will now stay in **${voiceChannel.name}** permanently.\nEven if kicked, it will rejoin automatically.`)
                        .addFields(
                            { name: '📢 Voice Channel', value: `<#${voiceChannel.id}>`, inline: true },
                            { name: '🛑 To Disable', value: '`/247 stop`', inline: true }
                        )
                        .setFooter({ text: 'Z-Core Music • 24/7 Mode', iconURL: musicIcons.footerIcon })
                        .setTimestamp()
                ]
            });
        }

        if (sub === 'stop') {
            if (!sessions.has(guildId)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff4444')
                            .setDescription('❌ **24/7 mode is not active on this server.**')
                    ],
                    ephemeral: true
                });
            }

            sessions.delete(guildId);

            // Disconnect the player
            try {
                if (client.riffy) {
                    const player = client.riffy.players.get(guildId);
                    if (player) player.destroy();
                }
            } catch (e) {}

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ff4444')
                        .setTitle('⏹️ 24/7 Mode Disabled')
                        .setDescription('The bot will no longer automatically rejoin voice channels.')
                        .setFooter({ text: 'Z-Core Music • 24/7 Mode', iconURL: musicIcons.footerIcon })
                        .setTimestamp()
                ]
            });
        }
    }
};
