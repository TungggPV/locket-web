
const { LocketClient } = require("./");
const readline = require("node:readline/promises");

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const email = await rl.question("Locket Email: ");
        const password = await rl.question("Locket Password: ");

        const client = new LocketClient({
            sessionPath: "locket.js_session.json"
        });

        if (!client.isAuthenticated()) {
            console.log("Logging in...");
            await client.login(email, password);
        }

        console.log("Authenticated:", client.isAuthenticated());

        const profile = await client.user.getProfile();

        console.log("Profile:", {
            first_name: profile.first_name,
            last_name: profile.last_name,
            username: profile.username
        });

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        rl.close();
    }
}

main();
