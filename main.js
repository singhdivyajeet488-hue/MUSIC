const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
require('dotenv').config();
const config = require('./config.json');
const colors = require('./UI/colors/colors');

const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => GatewayIntentBits[a]),
    partials: [Partials.Channel]
});

client.commands = new Collection();
require('events').defaultMaxListeners = 100;

const loadCommands = async () => {
    const fs = require('fs');
    const path = require('path');
    const commandsPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(commandsPath);
    const enabledFolders = commandFolders.filter(folder => config.categories[folder]);

    const commands = [];

    for (const folder of enabledFolders) {
        const files = fs.readdirSync(path.join(commandsPath, folder)).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const command = require(path.join(commandsPath, folder, file));
            if (command.data) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
            }
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN || config.token);
    try {
        if (config.guildId && config.guildId !== 'YOUR_SERVER_ID_HERE') {
            // Guild-scoped = instant (use this for development / single server)
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, config.guildId),
                { body: commands }
            );
            console.log(`[ COMMANDS ] Loaded ${commands.length} music commands (guild) ✅`);
        } else {
            // Global = up to 1 hour propagation
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log(`[ COMMANDS ] Loaded ${commands.length} music commands (global) ✅`);
        }
    } catch (error) {
        console.error('[ ERROR ] Failed to register commands:', error);
    }
};

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(error);
        const msg = { content: 'There was an error executing this command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg);
        } else {
            await interaction.reply(msg);
        }
    }
});

client.once('ready', async () => {
    console.log(`[ CORE ] Bot: ${client.user.tag}`);
    console.log(`[ CORE ] ID:  ${client.user.id}`);
    await loadCommands();
});

client.on('raw', (d) => {
    if (client.riffy) client.riffy.updateVoiceState(d);
});

client.login(process.env.TOKEN || config.token);

module.exports = client;
