
const { LocketClient } = require("./");

async function main() {
    const client = new LocketClient({
        sessionPath: "locket.js_session.json"
    });

    console.log("Client initialized:", !!client);
    console.log("Authenticated:", client.isAuthenticated());
}

main().catch(console.error);
