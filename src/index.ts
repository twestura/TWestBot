/** TWestBot for interacting with TWest's Twitch chat. */

// TODO fix project settings so don't need the `.js` and unresolved error
// ignores.

//import { exists, fstat } from "fs";
import fetch from "node-fetch";
import { env } from "process";
import { Client } from "tmi.js";
import { appendFileSync, existsSync, readFileSync } from "fs";
import { rand_int } from "./rand.js";
// eslint-disable-next-line import/no-unresolved
import { EnvValues, load_env } from "./load_env.js";

/** Link to join my Discord server. */
const LINK_DISCORD = "discord.gg/N2qSkbk";

/** Link to my Instagram page. */
const LINK_INSTAGRAM = "https://www.instagram.com/twestaoe/";

/** Link to my Patreon page. */
const LINK_PATREON = "patreon.com/twest";

/** Link to my TikTok account. */
const LINK_TIKTOK = "tiktok.com/@twestaoe";

/** Link to my Twitter account. */
const LINK_TWITTER = "twitter.com/TravisWestura";

/** Link to my website. */
const LINK_WEBSITE = "twestaoe.net";

/** Link to my YouTube channel. */
const LINK_YOUTUBE = "youtube.com/TWestYT";

/** The time within which a command cannot be executed multiple times. */
const COOLDOWN_DELAY = 5000;

/** Error message to display when an API request fails. */
const FETCH_ERR_MSG = "aoe2.net is down.";

/** File path to the entrants for the current giveaway. */
const GIVEAWAY_FILE = "resources/giveaway.csv";

/** Describes the giveaway and how to enter. */
const GIVEAWAY_MSG =
  "Vitalis is giving away a copy of Aoe 1, 2, or 3 DE or any DLC (your choice). Type !enter to enter.";

/** Message about Kamigawa's pizzeria. */
const PIZZA_MESSAGE =
  "Check out Kamigawa's Pizzeria in Berlin: https://www.byebyecavaliere.de";

/** Message with a Discount code for the NAC watch party. */
const NAC_DISCOUNT =
  "Want to come to the NAC Watch Party? Use my discount code for 20% off: NOBLETWEST20";

/** Message linking to the Instagram post of my Male Villager cosplay. */
const COSPLAY =
  "I did a Male Villager cosplay: https://www.instagram.com/p/DCW-74uxFHh";

/** Message about garrison tickets. */
const GARRISON_TICKETS =
  "Join The Garrison in Hamburg, Germany! Whether as a player or a spectator, be part of the action. Get your tickets here: https://www.eventbrite.com/e/the-garrison-tickets-1043494268447";

/** Message about the Garrison. */
const GARRISON_MESSAGE =
  "Get more information about The Garrison Offline Event in Hamburg, Germany on liquipedia or in our handbook: https://data.being-cloud.com/s/sRQBaW9q8nGfc68  https://liquipedia.net/ageofempires/The_Garrison";

/** Link to the Garrison Discord. */
const GARRISON_DISCORD =
  "Join the official The Garrison Discord to stay informed about the event: https://discord.gg/rSdW4DCPMw";

/** Message about TTL4. */
const TTL4_MESSAGE =
  "T90 Titans League is hosted by T90Official (https://twitch.tv/T90Official) & sponsored by World’s Edge. You can read more about it here - https://liquipedia.net/ageofempires/T90_Titans_League/4/Platinum_League";

/** Message about the France-Germany charity. */
const CHARITY =
  "All donations go to DKMS (German Bone Marrow Donor Center) to support the fight against blood cancer. https://tinyurl.com/gerfradkms";

/** WH2 message. */
const WALLHALLA2 =
  "Wallhalla 2 hosted by JonSlow (https://www.twitch.tv/jonslow_) and Ornlu (https://www.twitch.tv/ornlu_aoe).";

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
  "charity",
  "commands",
  "cosplay",
  "discord",
  "garrisondiscord",
  "instagram",
  // "draw",
  // "enter",
  // "giveaway",
  "nacdiscount",
  "patreon",
  "pizza",
  // "start",
  // "stop",
  "thegarrison",
  "tickets",
  "tiktok",
  "ttl",
  "twitter",
  "website",
  "wh2",
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
    const headers = new Headers({ "User-Agent": "TWestBot/5.5" });
    const query = arg === "" ? `steam_id=${id_steam}` : `search=${arg}`;
    const url = `https://aoe2.net/api/nightbot/${component}game=aoe2de&${query}`;
    try {
      const response = await fetch(url);
      if (response.status !== 200) console.log(response); // TODO remove after debugging
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
      // cmd.prefix !== "enter" &&
      Date.now() - last_execution.get(cmd.prefix) <= COOLDOWN_DELAY
    ) {
      console.log(`Command ${cmd.prefix} on cooldown.`);
      return;
    }
    last_execution.set(cmd.prefix, Date.now());

    switch (cmd.prefix) {
      case "charity":
        client.say(channel, CHARITY);
        break;
      case "commands":
        client.say(channel, list_commands());
        break;
      case "cosplay":
        client.say(channel, COSPLAY);
        break;
      case "discord":
        client.say(channel, LINK_DISCORD);
        break;
      case "garrisondiscord":
        client.say(channel, GARRISON_DISCORD);
        break;
      // case "draw":
      //   if (tags["user-id"] != env.id_twitch) break; // Only I may draw.
      //   const n = parseInt(cmd.arg);
      //   if (isNaN(n) || n <= 0) {
      //     console.log(`${n} is not a valid number of winners.`);
      //     break;
      //   }
      //   const winners = draw_winners(n);
      //   console.log(`winners: ${winners}`); // Log twitch IDs to console.
      //   client.say(channel, winner_msg(winners));
      //   break;
      // case "enter":
      //   if (!is_giveaway_live) break;
      //   if (tags["user-id"] !== undefined && tags["display-name"] !== undefined)
      //     add_entrant(tags["user-id"], tags["display-name"]);
      //   break;
      // case "giveaway":
      //   client.say(channel, GIVEAWAY_MSG);
      //   break;
      // case "start":
      //   if (tags["user-id"] != env.id_twitch) break; // Only I may start.
      //   is_giveaway_live = true;
      //   break;
      // case "stop":
      //   if (tags["user-id"] != env.id_twitch) break; // Only I may stop.
      //   is_giveaway_live = false;
      //   break;
      case "instagram":
        client.say(channel, LINK_INSTAGRAM);
        break;
      case "nacdiscount":
        client.say(channel, NAC_DISCOUNT);
        break;
      case "patreon":
        client.say(channel, LINK_PATREON);
        break;
      case "pizza":
        client.say(channel, PIZZA_MESSAGE);
        break;
      case "thegarrison":
        client.say(channel, GARRISON_MESSAGE);
        break;
      case "tickets":
        client.say(channel, GARRISON_TICKETS);
        break;
      case "tiktok":
        client.say(channel, LINK_TIKTOK);
        break;
      case "ttl":
        client.say(channel, TTL4_MESSAGE);
        break;
      case "twitter":
        client.say(channel, LINK_TWITTER);
        break;
      case "website":
        client.say(channel, LINK_WEBSITE);
        break;
      case "wh2":
        client.say(channel, WALLHALLA2);
        break;
      case "youtube":
        client.say(channel, LINK_YOUTUBE);
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

main(); // Runs the bot by calling `main`.
