/** Utilities for loading from the env file. */

// TODO fix project settings so don't need the `.js` and unresolved error
// ignores.

import * as dotenv from "dotenv";
// eslint-disable-next-line import/no-unresolved
import { err, ok, Result } from "./result.js";
dotenv.config();

/** An instance represents the values needed to log in with the bot. */
export type EnvValues = {
  /**
   * The account name of the Twitch channel with which the bot chats.
   * This name is used by the bot when it write messages.
   */
  id_username: string;

  /** The authentication token for logging in with the bot. */
  id_password: string;

  /**
   * The account name of the Twitch channel in which the bot chats.
   * The bot writes message in this channel's chat.
   */
  channel: string;

  /** The id of my steam account. */
  id_steam: string;
};

/** Returns the bot username, or an error if it cannot be loaded. */
const load_username: () => Result<string, string> = () => {
  const name = process.env.ID_USERNAME;
  return name !== undefined ? ok(name) : err("Cannot load bot id username.");
};

/** Returns the bot's authentication token/password. */
const load_password: () => Result<string, string> = () => {
  const pw = process.env.ID_PASSWORD;
  return pw !== undefined ? ok(pw) : err("Cannot load password.");
};

/** Returns the channel in which the bot interacts. */
const load_channel: () => Result<string, string> = () => {
  const channel = process.env.CHANNEL;
  return channel !== undefined ? ok(channel) : err("Cannot load channel.");
};

/** Returns my Steam id number. */
const load_steam: () => Result<string, string> = () => {
  const steam = process.env.ID_STEAM;
  return steam !== undefined ? ok(steam) : err("Cannot load Steam ID.");
};

/** Returns the result of loading the `.env` file. */
export const load_env: () => Result<EnvValues, Array<string>> = () => {
  const name = load_username();
  const pw = load_password();
  const channel = load_channel();
  const steam = load_steam();

  if (name.ok && pw.ok && channel.ok && steam.ok)
    return ok({
      id_username: name.val,
      id_password: pw.val,
      channel: channel.val,
      id_steam: steam.val,
    });

  const errors = [];
  if (!name.ok) errors.push(name.err);
  if (!pw.ok) errors.push(pw.err);
  if (!channel.ok) errors.push(channel.err);
  if (!steam.ok) errors.push(steam.err);
  return err(errors);
};
