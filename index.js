// ==================== RIFFY SAFETY PATCH ====================
try {
    const structures = require('riffy/build/structures/Node');
    if (structures && structures.Node && structures.Node.prototype) {
        const originalOpen = structures.Node.prototype.open;
        structures.Node.prototype.open = async function(...args) {
            try {
                return await originalOpen.apply(this, args);
            } catch (err) {
                if (err.message && err.message.includes('nodeFetchInfo')) {
                    console.log(`[V2 LAVALINK] Safely bypassed nodeFetchInfo error.`);
                    return;
                }
                throw err;
            }
        };
    }
} catch (e) {}
// ============================================================

require('dotenv').config();

const { connectToDatabase } = require('./mongodb');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    await connectToDatabase();
    const client = require('./main');

    await new Promise((resolve) => {
        if (client.isReady()) resolve();
        else client.once('ready', resolve);
    });

    await delay(2000);

    // Load Lavalink music system (sets up client.riffy)
    try {
        require('./events/music')(client);
        console.log('[ LAVALINK ] Music system loaded ✅');
    } catch (error) {
        console.error('[ ERROR ] Failed to load music system:', error);
    }

    await delay(3000);

    // Load DisTube music system
    require('./handlers/distube')(client);
    console.log('[ DISTUBE ] DisTube system loaded ✅');
})();
