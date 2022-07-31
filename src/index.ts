/** TWestBot for interacting with TWest's Twitch chat. */

// TODO fix project settings so don't need the `.js` and unresolved error
// ignores.

import { exists, fstat } from "fs";
import fetch from "node-fetch";
import { env } from "process";
import { Client } from "tmi.js";
import { appendFileSync, existsSync, readFileSync } from "fs";
import { rand_int } from "./rand.js";
// eslint-disable-next-line import/no-unresolved
import { EnvValues, load_env } from "./load_env.js";

/** Link to join my Discord server. */
const LINK_DISCORD = "discord.gg/N2qSkbk";

/** Link to my Patreon page. */
const LINK_PATREON = "patreon.com/twest";

/** Link to my Twitter account. */
const LINK_TWITTER = "twitter.com/TravisWestura";

/** Link to my YouTube channel. */
const LINK_YOUTUBE = "youtube.com/TWestYT";

/** The time within which a command cannot be executed multiple times. */
const COOLDOWN_DELAY = 5000;

/** Error message to display when an API request fails. */
const FETCH_ERR_MSG = "aoe2.net is down.";

/** Message for RMSC2. */
const RMSC2 =
  "RMS Cup 2 is happening in July, $24k prizepool sponsored by Microsoft. Organized and hosted by Nova, Ornlu, and sieste: https://www.twitch.tv/novaaoe https://www.twitch.tv/OrnLu_AoE https://www.twitch.tv/multiples_siestes All info on Discord: https://discord.gg/bD9mABVmms";

/** File path to the entrants for the current giveaway. */
const GIVEAWAY_FILE = "resources/giveaway.csv";

/** Describes the giveaway and how to enter. */
const GIVEAWAY_MSG = "<giveaway description here>. Type !enter to enter.";

/**
 * Utility function to ensure exhaustiveness of switch statements on literal
 * union types.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assert_unreachable(_: never): never {
  throw new Error("Unreachable.");
}

/** The names of bot commands. Sorted lexicographically. */
const command_names = [
  "civs",
  "commands",
  "discord",
  "draw",
  "elo",
  "enter",
  "giveaway",
  "map",
  "match",
  "patreon",
  "rank",
  "rating",
  "rmsc2",
  "start",
  "stop",
  "twitter",
  "youtube",
] as const;

/** Union of literal types representing the bot command names. */
type Prefix = typeof command_names[number];

/** Type guard that returns whether `s` represents a command prefix. */
function is_command_name(s: string): s is Prefix {
  return command_names.includes(s as Prefix);
}

/** A twitch command with a prefix and argument. */
type Cmd = {
  /** The command prefix for the string indicating which command to execute. */
  prefix: Prefix;

  /** Command argument. */
  arg: string;
};

/**
 * Returns the index of the first space of `s`, if a space is present.
 * If no space is present, returns the length of `s`.
 */
const get_prefix_end: (s: string) => number = (s) => {
  const k = s.indexOf(" ");
  return k !== -1 ? k : s.length;
};

/**
 * Parses `s` to return the command to execute, if `s` starts with a valid
 * command name preceded by an exclamation mark. Command parsing is greedy,
 * so `!valid` is a command but `!validWithExtraCharacters` is not.
 * All characters before the first space, or the entire string if no space is
 * present, are part of the command name.
 * Commands name matching is case insensitive.
 *
 * Everything after the first space is used as the parameter.
 * If there is no space, then the argument is the empty string.
 */
const parse_command: (s: string) => Cmd | undefined = (s) => {
  if (!s.startsWith("!")) return undefined;
  const k = get_prefix_end(s);
  const name = s.substring(1, k);
  if (!is_command_name(name)) return undefined;
  const arg = s.substring(k + 1);
  return { prefix: name, arg };
};

// TODO link to my website with a list of commands there once that's set up.
/** Returns a string containing the commands this bot can execute. */
const list_commands: () => string = () =>
  command_names.map((s) => `!${s}`).join(" ");

/** Returns a string description of the names of the winners. */
const winner_msg: (ws: Array<[string, string]>) => string = (ws) => {
  if (ws.length === 0) return "No entrants.";
  const ns = ws
    .map(([_, n]) => n)
    .sort()
    .join(", ");
  return ws.length === 1 ? `The winner is: ${ns}` : `The winners are: ${ns}`;
};

/**
 * Creates the chat bot, sets up event handlers, and logs the bot into Twitch.
 * The bot is active in the chat upon completion of this function.
 */
const create_bot: (env: EnvValues) => void = () => {
  /** `true` if a giveaway may have new entrants added, `false` if not. */
  let is_giveaway_live = false;

  /** Client options. */
  const options = {
    options: { debug: true },
    identity: {
      username: env.id_username as string,
      password: env.id_password as string,
    },
    channels: [env.channel as string],
  };

  /** `tmi.js` client. */
  const client = new Client(options);

  /**
   * Maps each command prefix to the last time it was executed.
   * A prefix is not in the map if it has not been executed while the bot
   * is active.
   */
  const last_execution = new Map();

  /** My Steam id, for fetching from aoe2.net. */
  const id_steam = env.id_steam as string;

  /**
   * Entrants in the current giveaway.
   * Maps a user's Twitch ID to their display name.
   * The pairs in this map are exactly the same as the rows in the
   * `GIVEAWAY_FILE` (disregarding order).
   */
  const entrants = new Map();
  // Initialize the list of giveaway entrants, if the file exists.
  if (existsSync(GIVEAWAY_FILE)) {
    const file_contents = readFileSync(GIVEAWAY_FILE).toString();
    const lines = file_contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line != "");
    for (const line of lines) {
      const [twitch_id, display_name] = line.split(/, /);
      entrants.set(twitch_id, display_name);
    }
  }

  /**
   * Adds a Twitch user to the giveaway if they are not already entered.
   * @param twitch_id the id of the user to add, must consist of only digits
   * @param display_name the user's display name
   */
  const add_entrant: (twitch_id: string, display_name: string) => void = (
    twitch_id,
    display_name
  ) => {
    if (entrants.has(twitch_id)) return;
    entrants.set(twitch_id, display_name);
    appendFileSync(GIVEAWAY_FILE, `${twitch_id}, ${display_name}\n`);
  };

  /**
   * Draws `n` winners randomly from the giveaway entrants.
   * If there are fewer than `n` entrants, then all entrants are returned.
   * @param n the number of winners to draw, must be a nonnegative integer
   * @returns the `[id, username]` pairs of the winners
   */
  const draw_winners: (n: number) => Array<[string, string]> = (n) => {
    const names = [...entrants.entries()];
    // names[i+1..] is randomized.
    for (let i = names.length - 1; i > 0; --i) {
      const j = rand_int(0, i);
      // Swap names[i] and names[j].
      const t = names[j];
      names[j] = names[i];
      names[i] = t;
    }
    return names.slice(0, Math.min(n, names.length));
  };

  /**
   * Returns the text body of a query to the aoe2.net api, or an error message
   * to display in chat if the request does not succeed.
   *
   * `component` is the component of the url containing the parameters for
   * the query, except for the details of the specific player whose data is
   * looked up.
   *
   * If `arg` is given, searches for that player. Otherwise searches for my
   * data using my Steam id.
   */
  const fetch_url: (component: string, arg: string) => Promise<string> = async (
    component,
    arg
  ) => {
    const query = arg === "" ? `steam_id=${id_steam}` : `search=${arg}`;
    const url = `https://aoe2.net/api/nightbot/${component}${query}`;
    try {
      const response = await fetch(url);
      return response.status === 200 ? response.text() : FETCH_ERR_MSG;
    } catch (_) {
      return FETCH_ERR_MSG;
    }
  };

  client.on("message", async (channel, tags, message, self) => {
    if (self) return;

    const cmd = parse_command(message.toLowerCase());
    if (cmd === undefined) return;

    // Skips the command if called multiple times within a short period of time.
    if (
      last_execution.has(cmd.prefix) &&
      cmd.prefix !== "enter" &&
      Date.now() - last_execution.get(cmd.prefix) <= COOLDOWN_DELAY
    ) {
      console.log(`Command ${cmd.prefix} on cooldown.`);
      return;
    }
    last_execution.set(cmd.prefix, Date.now());

    switch (cmd.prefix) {
      case "commands":
        client.say(channel, list_commands());
        break;
      case "civs":
        client.say(channel, await fetch_url("civs?", cmd.arg));
        break;
      case "discord":
        client.say(channel, LINK_DISCORD);
        break;
      case "draw":
        if (tags["user-id"] != env.id_twitch) break; // Only I may draw.
        const n = parseInt(cmd.arg);
        if (isNaN(n) || n <= 0) {
          console.log(`${n} is not a valid number of winners.`);
          break;
        }
        const winners = draw_winners(n);
        console.log(`winners: ${winners}`); // Log twitch IDs to console.
        client.say(channel, winner_msg(winners));
        break;
      case "enter":
        if (!is_giveaway_live) break;
        if (tags["user-id"] !== undefined && tags["display-name"] !== undefined)
          add_entrant(tags["user-id"], tags["display-name"]);
        break;
      case "giveaway":
        client.say(channel, GIVEAWAY_MSG);
        break;
      case "start":
        if (tags["user-id"] != env.id_twitch) break; // Only I may start.
        is_giveaway_live = true;
        break;
      case "stop":
        if (tags["user-id"] != env.id_twitch) break; // Only I may stop.
        is_giveaway_live = false;
        break;
      case "map":
        client.say(channel, await fetch_url("map?", cmd.arg));
        break;
      case "match":
        client.say(
          channel,
          await fetch_url("match?color=true&flag=false&", cmd.arg)
        );
        break;
      case "patreon":
        client.say(channel, LINK_PATREON);
        break;
      case "rmsc2":
        client.say(channel, RMSC2);
        break;
      case "twitter":
        client.say(channel, LINK_TWITTER);
        break;
      case "youtube":
        client.say(channel, LINK_YOUTUBE);
        break;
      case "elo":
      case "rank":
      case "rating":
        client.say(
          channel,
          await fetch_url("rank?leaderboard_id=3&flag=false&", cmd.arg)
        );
        break;
      default:
        assert_unreachable(cmd.prefix);
    }
  });
  // TODO handle connection error.
  client.connect().catch(console.error);
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
