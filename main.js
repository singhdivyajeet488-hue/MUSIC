const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();
const config = require('./config.json');
const colors = require('./UI/colors/colors');
const { EmbedBuilder, Partials } = require('discord.js');

const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => GatewayIntentBits[a]),
    partials: [Partials.Channel]
});

client.commands = new Collection();
require('events').defaultMaxListeners = 100;

// Load music event (DisTube events via distube handler, fired from events/music.js)
const loadDistube = require('./handlers/distube');

// Register slash commands from enabled categories
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
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`[ COMMANDS ] Loaded ${commands.length} music commands ✅`);
    } catch (error) {
        console.error('[ ERROR ] Failed to register commands:', error);
    }
};

// Handle slash command interactions
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

    // Initialize DisTube music system
    await loadDistube(client);
    console.log('[ MUSIC ] DisTube music system initialized ✅');

    await loadCommands();
});

client.login(process.env.TOKEN || config.token);

module.exports = client;
