import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import {
  ApplicationCommandOptionType,
  LocalizationMap,
} from 'discord-api-types/v9';
import { SlashasaurusClient } from './SlashasaurusClient';
import {
  MapOptionsToAutocompleteNames,
  CommandOptionsObject,
  MaybePromise,
} from './utilityTypes';
import { ApplicationCommandOptionData, OptionsDataArray } from './OptionTypes';
import { ValidationError } from './CustomErrors';

type ChatCommandOptions<T> = {
  name: string;
  nameLocalizations?: LocalizationMap;
  description: string;
  descriptionLocalizations?: LocalizationMap;
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
  validatorsMap: Map<
    string,
    (
      interaction: CommandInteraction,
      value: any
    ) => MaybePromise<boolean | string>
  > = new Map();
  transformersMap: Map<string, (value: any) => MaybePromise<any>> = new Map();
  autocompleteMap: Map<
    string,
    (
      interaction: AutocompleteInteraction,
      value: any,
      client: SlashasaurusClient
    ) => MaybePromise<any>
  > = new Map();

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
    commandInfo.options.forEach((option) => {
      if ('validator' in option)
        this.validatorsMap.set(option.name, option.validator);
      if ('transformer' in option)
        this.transformersMap.set(option.name, option.transformer);
      if ('onAutocomplete' in option)
        this.autocompleteMap.set(option.name, option.onAutocomplete);
    });
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

  async validateAndTransformOptions(
    interaction: CommandInteraction
  ): Promise<CommandOptionsObject<T> | string[]>;
  async validateAndTransformOptions(
    interaction: AutocompleteInteraction,
    skipRequiredCheck: boolean
  ): Promise<CommandOptionsObject<T>>;
  async validateAndTransformOptions(
    interaction: CommandInteraction | AutocompleteInteraction,
    skipRequiredCheck: boolean = false
  ): Promise<CommandOptionsObject<T> | string[]> {
    const errors: string[] = [];
    const values: Record<string, any> = {};
    for (const option of this.commandInfo.options) {
      // Get the option data
      let value = getDataForType(
        interaction,
        option.type,
        option.name,
        skipRequiredCheck ? false : option.required ?? false
      );

      // If the value is undefined, assign early and continue to skip the rest of the validation and transformation
      if (value === null) {
        values[option.name] = null;
        continue;
      }

      // Check if the option has a validator
      let isValid = true;
      if (
        this.validatorsMap.has(option.name) &&
        interaction instanceof CommandInteraction
      ) {
        // Run the validator
        try {
          const validateResult = await this.validatorsMap.get(option.name)!(
            interaction,
            value
          );
          if (typeof validateResult === 'string') {
            errors.push(validateResult);
            isValid = false;
          }
        } catch (e) {
          if (e instanceof ValidationError) {
            // This threw a validation error, add the message to our errors array
            errors.push(e.message);
          } else {
            // This threw a different error, throw it
            throw e;
          }
        }
      }
      // If the option is invalid, skip it
      if (!isValid) continue;

      // Check if the option has a transformer
      if (this.transformersMap.has(option.name)) {
        // Run the transformer
        value = await this.transformersMap.get(option.name)!(value);
      }

      // Add the value to the values object
      values[option.name] = value;
    }
    if (errors.length > 0) return errors;
    return values as CommandOptionsObject<T>;
  }
}

function getDataForType(
  interaction: CommandInteraction | AutocompleteInteraction,
  type: ApplicationCommandOptionData['type'],
  name: string,
  required: boolean
) {
  switch (type) {
    case 'STRING':
    case ApplicationCommandOptionType.String:
      return interaction.options.getString(name, required);
    case 'INTEGER':
    case ApplicationCommandOptionType.Integer:
      return interaction.options.getInteger(name, required);
    case 'BOOLEAN':
    case ApplicationCommandOptionType.Boolean:
      return interaction.options.getBoolean(name, required);
    case 'USER':
    case ApplicationCommandOptionType.User:
      return (
        interaction.options.getMember(name, required) ??
        interaction.options.getUser(name, required)
      );
    case 'CHANNEL':
    case ApplicationCommandOptionType.Channel:
      return interaction.options.getChannel(name, required);
    case 'ROLE':
    case ApplicationCommandOptionType.Role:
      return interaction.options.getRole(name, required);
    case 'MENTIONABLE':
    case ApplicationCommandOptionType.Mentionable:
      return interaction.options.getMentionable(name, required);
    case 'NUMBER':
    case ApplicationCommandOptionType.Number:
      return interaction.options.getNumber(name, required);
    case 'ATTACHMENT':
    case ApplicationCommandOptionType.Attachment:
      return interaction.options.getAttachment(name, required);
  }
}
