import {
  ApplicationCommandOptionData,
  AutocompleteInteraction,
  CommandInteraction,
} from 'discord.js';
import { InteractionsClient } from './InteractionsClient';
import {
  CommandOptionsObject,
  MapOptionsToAutocompleteNames,
  ReadonlyCommandOptionsObject,
} from './utilityTypes';

type ChatCommandOptions<T> = {
  name: string;
  description: string;
  type: 'CHAT_INPUT';
  options: T;
  defaultPermission?: boolean;
};
export abstract class SlashCommandBase<
  T extends Array<ApplicationCommandOptionData>
> {
  commandInfo: ChatCommandOptions<T>;

  constructor(commandInfo: ChatCommandOptions<T>) {
    this.commandInfo = commandInfo;
  }

  abstract run(
    interaction: CommandInteraction,
    client: InteractionsClient<any, any>,
    options: CommandOptionsObject<T>
  ): void;

  abstract autocomplete(
    interaction: AutocompleteInteraction,
    focusedName: MapOptionsToAutocompleteNames<T>,
    focusedValue: string | number,
    client: InteractionsClient<any, any>,
    options: CommandOptionsObject<T>
  ): void;
}

type HandlersType<
  T extends ReadonlyArray<ApplicationCommandOptionData>,
  U extends InteractionsClient<any, any>
> = MapOptionsToAutocompleteNames<T> extends never
  ? {
      run: (
        interaction: CommandInteraction,
        client: U,
        options: ReadonlyCommandOptionsObject<T>
      ) => void;
    }
  : HandlersWithAutoComplete<T, U>;

type HandlersWithAutoComplete<
  T extends ReadonlyArray<ApplicationCommandOptionData>,
  U extends InteractionsClient<any, any>
> = {
  run: (
    interaction: CommandInteraction,
    client: U,
    options: ReadonlyCommandOptionsObject<T>
  ) => void;
  autocomplete: (
    interaction: AutocompleteInteraction,
    focusedName: MapOptionsToAutocompleteNames<T>,
    focusedValue: string | number,
    client: U,
    options: Partial<ReadonlyCommandOptionsObject<T>>
  ) => void;
};

function handlersHasAutocomplete<
  T extends ReadonlyArray<ApplicationCommandOptionData>,
  U extends InteractionsClient<any, any>
>(handlers: HandlersType<T, U>): handlers is HandlersWithAutoComplete<T, U> {
  return 'autocomplete' in handlers;
}

export class SlashCommand<
  U extends InteractionsClient<any, any>,
  T extends ReadonlyArray<ApplicationCommandOptionData>
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
    // @ts-expect-error
    if (handlersHasAutocomplete(handlers))
      this.autocomplete = handlers.autocomplete;
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
