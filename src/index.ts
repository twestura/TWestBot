/** TWestBot for interacting with TWest's Twitch chat. */

// TODO fix project settings so don't need the `.js` and unresolved error
// ignores.

import fetch from "node-fetch";
import { env } from "process";
import { Client } from "tmi.js";
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
  "elo",
  "map",
  "match",
  "patreon",
  "rank",
  "rating",
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

/**
 * Creates the chat bot, sets up event handlers, and logs the bot into Twitch.
 * The bot is active in the chat upon completion of this function.
 */
const create_bot: (env: EnvValues) => void = () => {
  const options = {
    options: { debug: true },
    identity: {
      username: env.id_username as string,
      password: env.id_password as string,
    },
    channels: [env.channel as string],
  };

  const client = new Client(options);

  const id_steam = env.id_steam as string;

  /**
   * Returns the text body of a query to the aoe2.net api.
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
    const response = await fetch(url);
    return response.text();
  };

  client.on("message", async (channel, tags, message, self) => {
    if (self) return;
    const cmd = parse_command(message.toLowerCase());
    if (cmd === undefined) return;
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
