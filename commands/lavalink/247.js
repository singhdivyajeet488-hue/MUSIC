const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const musicIcons = require('../../UI/icons/musicicons');

// In-memory store: guildId -> { voiceChannelId, textChannelId }
const sessions247 = new Map();

module.exports = {
    sessions247,

    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Keep the bot in voice channel 24/7')
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Start 24/7 mode — bot stays in your VC even if kicked')
        )
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Stop 24/7 mode and allow the bot to disconnect')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

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
                            .setTitle('❌ Not in Voice Channel')
                            .setDescription('You need to be in a voice channel first!')
                            .setFooter({ text: 'Z-Core Music', iconURL: musicIcons.footerIcon })
                    ],
                    ephemeral: true
                });
            }

            if (sessions247.has(guildId)) {
                const existing = sessions247.get(guildId);
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ffaa00')
                            .setTitle('⚠️ Already Active')
                            .setDescription(`24/7 mode is already enabled in <#${existing.voiceChannelId}>.\nUse \`/247 stop\` to disable it first.`)
                            .setFooter({ text: 'Z-Core Music', iconURL: musicIcons.footerIcon })
                    ],
                    ephemeral: true
                });
            }

            // Save session
            sessions247.set(guildId, {
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channel.id,
            });

            // Join via riffy if not already in VC
            try {
                if (client.riffy) {
                    let player = client.riffy.players.get(guildId);
                    if (!player) {
                        player = client.riffy.createConnection({
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
                        .setDescription(`Bot will stay in **${voiceChannel.name}** permanently.\nIf kicked, it will automatically rejoin.`)
                        .addFields(
                            { name: '📢 Channel', value: `<#${voiceChannel.id}>`, inline: true },
                            { name: '🛑 To Stop', value: '`/247 stop`', inline: true }
                        )
                        .setFooter({ text: 'Z-Core Music • 24/7 Mode', iconURL: musicIcons.footerIcon })
                        .setTimestamp()
                ]
            });
        }

        if (sub === 'stop') {
            if (!sessions247.has(guildId)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff4444')
                            .setTitle('❌ Not Active')
                            .setDescription('24/7 mode is not currently enabled on this server.')
                            .setFooter({ text: 'Z-Core Music', iconURL: musicIcons.footerIcon })
                    ],
                    ephemeral: true
                });
            }

            sessions247.delete(guildId);

            // Destroy the riffy player
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
                        .setDescription('The bot will no longer rejoin automatically.')
                        .setFooter({ text: 'Z-Core Music', iconURL: musicIcons.footerIcon })
                        .setTimestamp()
                ]
            });
        }
    }
};
