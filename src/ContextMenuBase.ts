import {
  MessageApplicationCommandData,
  MessageContextMenuInteraction,
  UserApplicationCommandData,
  UserContextMenuInteraction,
} from 'discord.js';
import type { LocalizationMap } from 'discord-api-types/v9';
import { SlashasaurusClient } from './SlashasaurusClient';

type ContextCommandOptions<T extends 'MESSAGE' | 'USER'> = {
  name: string;
  nameLocalizations?: LocalizationMap;
  type: T;
  defaultPermission?: boolean;
};

export type ContextMenuHandlerType<T extends 'MESSAGE' | 'USER'> =
  T extends 'MESSAGE'
    ? (
        interaction: MessageContextMenuInteraction,
        client: SlashasaurusClient
      ) => void
    : (
        interaction: UserContextMenuInteraction,
        client: SlashasaurusClient
      ) => void;

export function isMessageCommand(thing: any): thing is MessageCommand {
  return thing instanceof MessageCommand;
}

export class MessageCommand {
  commandInfo: MessageApplicationCommandData;

  /**
   *
   * @param commandInfo The general info for the command
   * @param handlers
   */
  constructor(
    commandInfo: Omit<ContextCommandOptions<'MESSAGE'>, 'type'>,
    run: ContextMenuHandlerType<'MESSAGE'>
  ) {
    this.commandInfo = {
      ...commandInfo,
      type: 'MESSAGE',
    };
    this.run = run;
  }

  run: ContextMenuHandlerType<'MESSAGE'>;
}

export function isUserCommand(thing: any): thing is UserCommand {
  return thing instanceof UserCommand;
}

export class UserCommand {
  commandInfo: UserApplicationCommandData;

  /**
   *
   * @param commandInfo The general info for the command
   * @param handlers
   */
  constructor(
    commandInfo: Omit<ContextCommandOptions<'USER'>, 'type'>,
    run: ContextMenuHandlerType<'USER'>
  ) {
    this.commandInfo = {
      ...commandInfo,
      type: 'USER',
    };
    this.run = run;
  }

  run: ContextMenuHandlerType<'USER'>;
}
