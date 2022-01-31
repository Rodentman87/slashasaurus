import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import { InteractionsClient } from './InteractionsClient';
import {
  MapOptionsToAutocompleteNames,
  ReadonlyApplicationCommandOptionData,
  ReadonlyCommandOptionsObject,
} from './utilityTypes';

type ChatCommandOptions<T> = {
  name: string;
  description: string;
  type: 'CHAT_INPUT';
  options: T;
  defaultPermission?: boolean;
};

export type CommandRunFunction<
  T extends ReadonlyArray<ReadonlyApplicationCommandOptionData>,
  U extends InteractionsClient
> = (
  interaction: CommandInteraction,
  client: U,
  options: ReadonlyCommandOptionsObject<T>
) => void;

export type AutocompleteFunction<
  T extends ReadonlyArray<ReadonlyApplicationCommandOptionData>,
  U extends InteractionsClient
> = (
  interaction: AutocompleteInteraction,
  focusedName: MapOptionsToAutocompleteNames<T>,
  focusedValue: string | number,
  client: U,
  options: Partial<ReadonlyCommandOptionsObject<T>>
) => void;

type HandlersType<
  T extends ReadonlyArray<ReadonlyApplicationCommandOptionData>,
  U extends InteractionsClient
> = MapOptionsToAutocompleteNames<T> extends never
  ? {
      run: CommandRunFunction<T, U>;
    }
  : HandlersWithAutoComplete<T, U>;

type HandlersWithAutoComplete<
  T extends ReadonlyArray<ReadonlyApplicationCommandOptionData>,
  U extends InteractionsClient
> = {
  run: CommandRunFunction<T, U>;
  autocomplete: AutocompleteFunction<T, U>;
};

export class SlashCommand<
  U extends InteractionsClient = InteractionsClient,
  T extends ReadonlyArray<ReadonlyApplicationCommandOptionData> = readonly []
> {
  commandInfo: ChatCommandOptions<T>;

  /**
   *
   * @param commandInfo The general info for the command
   * @param handlers
   */
  constructor(
    commandInfo: Omit<ChatCommandOptions<T>, 'type'>,
    handlers: HandlersType<T, U>
  ) {
    const info: ChatCommandOptions<T> = commandInfo as ChatCommandOptions<T>;
    info.type = 'CHAT_INPUT';
    this.commandInfo = info;
    this.run = handlers.run;
    if ('autocomplete' in handlers) this.autocomplete = handlers.autocomplete;
  }

  run(
    interaction: CommandInteraction,
    _client: U,
    _options: ReadonlyCommandOptionsObject<T>
  ) {
    interaction.reply({
      content: 'This command is not implemented yet',
      ephemeral: true,
    });
  }

  autocomplete(
    interaction: AutocompleteInteraction,
    _focusedName: MapOptionsToAutocompleteNames<T>,
    _focusedValue: string | number,
    _client: U,
    _options: Partial<ReadonlyCommandOptionsObject<T>>
  ) {
    interaction.respond([
      {
        name: "This interaction isn't implemented yet",
        value: 'error',
      },
    ]);
  }
}
