import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import { SlashasaurusClient } from './SlashasaurusClient';
import {
  MapOptionsToAutocompleteNames,
  CommandOptionsObject,
  OptionsDataArray,
} from './utilityTypes';

type ChatCommandOptions<T> = {
  name: string;
  description: string;
  options: T;
  defaultPermission?: boolean;
};

export type CommandRunFunction<T extends OptionsDataArray> = (
  interaction: CommandInteraction,
  client: SlashasaurusClient,
  options: CommandOptionsObject<T>
) => void;

export type AutocompleteFunction<T extends OptionsDataArray> = (
  interaction: AutocompleteInteraction,
  focusedName: MapOptionsToAutocompleteNames<T>,
  focusedValue: string | number,
  client: SlashasaurusClient,
  options: Partial<CommandOptionsObject<T>>
) => void;

type HandlersType<T extends OptionsDataArray> =
  MapOptionsToAutocompleteNames<T> extends never
    ? {
        run: CommandRunFunction<T>;
      }
    : HandlersWithAutoComplete<T>;

type HandlersWithAutoComplete<T extends OptionsDataArray> = {
  run: CommandRunFunction<T>;
  autocomplete: AutocompleteFunction<T>;
};

export function isChatCommand(command: any): command is SlashCommand<any> {
  return command instanceof SlashCommand;
}

export class SlashCommand<T extends OptionsDataArray> {
  commandInfo: ChatCommandOptions<T> & { type: string };

  /**
   *
   * @param commandInfo The general info for the command
   * @param handlers
   */
  constructor(commandInfo: ChatCommandOptions<T>, handlers: HandlersType<T>) {
    this.commandInfo = {
      ...commandInfo,
      type: 'CHAT_INPUT',
    };
    this.run = handlers.run;
    if ('autocomplete' in handlers) this.autocomplete = handlers.autocomplete;
  }

  run(
    interaction: CommandInteraction,
    _client: SlashasaurusClient,
    _options: CommandOptionsObject<T>
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
    _client: SlashasaurusClient,
    _options: Partial<CommandOptionsObject<T>>
  ) {
    interaction.respond([
      {
        name: "This interaction isn't implemented yet",
        value: 'error',
      },
    ]);
  }
}
