/** TWestBot for interacting with TWest's Twitch chat. */

import { load_env } from "./load_env";

/** Returns a string containing the commands this bot can execute. */
const list_commands: () => string = () =>
  "!commands !civs !elo !map !match !rank !rating";

/** Runs the bot. */
const main = () => {
  console.log("Hello, World!");
  console.log(list_commands());
  console.log(load_env());
};

// Runs the bot by calling `main`.
main();
