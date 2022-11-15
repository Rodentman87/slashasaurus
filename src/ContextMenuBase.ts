import type { LocalizationMap } from 'discord-api-types/v10';
import { SlashasaurusClient } from './SlashasaurusClient';

type ContextCommandOptions<T extends 'MESSAGE' | 'USER'> = {
  name: string;
  nameLocalizations?: LocalizationMap;
  type: T;
  defaultMemberPermissions?: string | number | bigint;
  dmPermission?: boolean;
};

export type ContextMenuHandlerType<T extends 'MESSAGE' | 'USER'> =
  T extends 'MESSAGE'
    ? (
        interaction: ConnectorTypes['MessageContextMenuCommandInteraction'],
        client: SlashasaurusClient
      ) => void
    : (
        interaction: ConnectorTypes['UserContextMenuCommandInteraction'],
        client: SlashasaurusClient
      ) => void;

export function isMessageCommand(thing: unknown): thing is MessageCommand {
  return thing instanceof MessageCommand;
}

export class MessageCommand {
  commandInfo: ContextCommandOptions<'MESSAGE'>;

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

export function isUserCommand(thing: unknown): thing is UserCommand {
  return thing instanceof UserCommand;
}

export class UserCommand {
  commandInfo: ContextCommandOptions<'USER'>;

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
