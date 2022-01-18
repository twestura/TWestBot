/** TWestBot for interacting with TWest's Twitch chat. */

import { env } from "process";
import { Client } from "tmi.js";
import { EnvValues, load_env } from "./load_env";

/** Returns a string containing the commands this bot can execute. */
const list_commands: () => string = () =>
  "!commands !civs !elo !map !match !rank !rating";

const create_bot: (env: EnvValues) => void = () => {
  console.log("creating bot");
  const options = {
    options: { debug: true },
    identity: {
      username: env.id_username as string,
      password: env.id_password as string,
    },
    channels: [env.channel as string],
  };

  const client = new Client(options);

  // TODO handle connection error.
  client.connect().catch(console.error);

  client.on("message", (channel, tags, message, self) => {
    if (self) return;
    // TODO proper command handling
    if (message.toLowerCase() === "!commands")
      client.say(channel, list_commands());
  });
};

/** Runs the bot. */
const main = () => {
  const env = load_env();
  if (!env.ok) {
    console.error("Cannot initialize TWestBot.");
    console.error(env.err.join("\n"));
    return;
  }

  create_bot(env.val);
};

// Runs the bot by calling `main`.
main();
