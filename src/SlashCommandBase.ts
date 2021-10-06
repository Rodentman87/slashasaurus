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
    client: InteractionsClient,
    options: CommandOptionsObject<T>
  ): void;

  abstract autocomplete(
    interaction: AutocompleteInteraction,
    focusedName: MapOptionsToAutocompleteNames<T>,
    focusedValue: string | number,
    client: InteractionsClient,
    options: CommandOptionsObject<T>
  ): void;
}

type HandlersType<T extends ReadonlyArray<ApplicationCommandOptionData>> =
  MapOptionsToAutocompleteNames<T> extends never
    ? {
        run: (
          interaction: CommandInteraction,
          client: InteractionsClient,
          options: ReadonlyCommandOptionsObject<T>
        ) => void;
      }
    : HandlersWithAutoComplete<T>;

type HandlersWithAutoComplete<
  T extends ReadonlyArray<ApplicationCommandOptionData>
> = {
  run: (
    interaction: CommandInteraction,
    client: InteractionsClient,
    options: ReadonlyCommandOptionsObject<T>
  ) => void;
  autocomplete: (
    interaction: AutocompleteInteraction,
    focusedName: MapOptionsToAutocompleteNames<T>,
    focusedValue: string | number,
    client: InteractionsClient,
    options: Partial<ReadonlyCommandOptionsObject<T>>
  ) => void;
};

function handlersHasAutocomplete<
  T extends ReadonlyArray<ApplicationCommandOptionData>
>(handlers: HandlersType<T>): handlers is HandlersWithAutoComplete<T> {
  return 'autocomplete' in handlers;
}

export class SlashCommand<
  T extends ReadonlyArray<ApplicationCommandOptionData>
> {
  commandInfo: ChatCommandOptions<T>;

  constructor(
    commandInfo: Omit<ChatCommandOptions<T>, 'type'>,
    handlers: HandlersType<T>
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
    // @ts-ignore
    client: InteractionsClient,
    // @ts-ignore
    options: ReadonlyCommandOptionsObject<T>
  ) {
    interaction.reply({
      content: 'This command is not implemented yet',
      ephemeral: true,
    });
  }

  autocomplete(
    interaction: AutocompleteInteraction,
    // @ts-ignore
    focusedName: MapOptionsToAutocompleteNames<T>,
    // @ts-ignore
    focusedValue: string | number,
    // @ts-ignore
    client: InteractionsClient,
    // @ts-ignore
    options: Partial<ReadonlyCommandOptionsObject<T>>
  ) {
    interaction.respond([
      {
        name: "This interaction isn't implemented yet",
        value: 'erro',
      },
    ]);
  }
}
