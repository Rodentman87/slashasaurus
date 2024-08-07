/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	SlashCommandAttachmentOption,
	SlashCommandBooleanOption,
	SlashCommandBuilder,
	SlashCommandChannelOption,
	SlashCommandIntegerOption,
	SlashCommandMentionableOption,
	SlashCommandNumberOption,
	SlashCommandRoleOption,
	SlashCommandStringOption,
	SlashCommandSubcommandBuilder,
	SlashCommandUserOption
} from "@discordjs/builders";
import {
	ApplicationCommandOptionType,
	InteractionType,
	LocalizationMap,
} from 'discord-api-types/v10';
import {
	ChatInputCommandInteraction,
} from 'discord.js';
import { Connector } from './Connector';
import { ValidationError } from './CustomErrors';
import { ApplicationCommandOptionData, OptionsDataArray } from './OptionTypes';
import { SlashasaurusClient } from './SlashasaurusClient';
import {
	CommandOptionsObject,
	GetConnectorType,
	MapOptionsToAutocompleteNames,
	MaybePromise,
} from './utilityTypes';

type ChatCommandOptions<T extends OptionsDataArray> = {
  name: string;
  nameLocalizations?: LocalizationMap;
  description: string;
  descriptionLocalizations?: LocalizationMap;
  options: T;
  defaultMemberPermissions?: string | number | bigint;
  dmPermission?: boolean;
};

export type CommandGroupMetadata = {
  nameLocalizations?: LocalizationMap;
  description: string;
  descriptionLocalizations?: LocalizationMap;
  defaultMemberPermissions?: string | number | bigint;
  dmPermission?: boolean;
};

export function isCommandGroupMetadata(arg: any): arg is CommandGroupMetadata {
  for (const key in arg) {
    if (key === 'description' && typeof arg[key] !== 'string') return false;
    if (key === 'descriptionLocalizations' && typeof arg[key] !== 'object')
      return false;
    if (
      key === 'defaultMemberPermissions' &&
      !(
        typeof arg[key] === 'number' ||
        typeof arg[key] === 'string' ||
        typeof arg[key] === 'bigint'
      )
    )
      return false;
    if (key === 'dmPermission' && typeof arg[key] !== 'boolean') return false;
  }
  return true;
}

export type CommandRunFunction<T extends OptionsDataArray> = (
  interaction: GetConnectorType<'ChatInputCommandInteraction'>,
  client: SlashasaurusClient,
  options: CommandOptionsObject<T>
) => void;

export type AutocompleteFunction<T extends OptionsDataArray> = (
  interaction: GetConnectorType<'AutocompleteInteraction'>,
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

export class SlashCommand<const T extends OptionsDataArray> {
  commandInfo: ChatCommandOptions<T> & { type: string };
  validatorsMap: Map<
    string,
    (
      interaction: ChatInputCommandInteraction,
      value: any
    ) => MaybePromise<boolean | string>
  > = new Map();
  transformersMap: Map<string, (value: any) => MaybePromise<any>> = new Map();
  autocompleteMap: Map<
    string,
    (
      interaction: GetConnectorType<'AutocompleteInteraction'>,
      value: any,
      client: SlashasaurusClient,
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
      if ('validator' in option && option.validator)
        this.validatorsMap.set(option.name, option.validator);
      if ('transformer' in option && option.transformer)
        this.transformersMap.set(option.name, option.transformer);
      if ('onAutocomplete' in option && option.onAutocomplete)
        this.autocompleteMap.set(option.name, option.onAutocomplete);
    });
    this.run = handlers.run;
    if ('autocomplete' in handlers) this.autocomplete = handlers.autocomplete;
  }

  run(
    _interaction: GetConnectorType<'ChatInputCommandInteraction'>,
    _client: SlashasaurusClient,
    _options: CommandOptionsObject<T>
  ) {
		throw new Error("not implemented");
  }

  autocomplete(
    _interaction: GetConnectorType<'AutocompleteInteraction'>,
    _focusedName: MapOptionsToAutocompleteNames<T>,
    _focusedValue: string | number,
    _client: SlashasaurusClient,
    _options: Partial<CommandOptionsObject<T>>
  ) {
		throw new Error("not implemented");
  }

  async validateAndTransformOptions(
    interaction: GetConnectorType<'ChatInputCommandInteraction'>,
		connector: Connector,
  ): Promise<CommandOptionsObject<T> | string[]>;
  async validateAndTransformOptions(
    interaction: GetConnectorType<'AutocompleteInteraction'>,
		connector: Connector,
    skipRequiredCheck: boolean,
    skipValidationAndTransformation: boolean
  ): Promise<CommandOptionsObject<T>>;
  async validateAndTransformOptions(
    interaction: GetConnectorType<'ChatInputCommandInteraction'> | GetConnectorType<'AutocompleteInteraction'>,
		connector: Connector,
    skipRequiredCheck = false,
    skipValidationAndTransformation = false
  ): Promise<CommandOptionsObject<T> | string[]> {
    const errors: string[] = [];
    const values: Record<string, any> = {};
    for (const option of this.commandInfo.options) {
      // Get the option data
      let value = interaction.type === InteractionType.ApplicationCommand ? connector.getOptionValue(
				interaction,
				option.type,
				option.name,
				skipRequiredCheck ? false : option.required ?? false
			) : connector.getAutocompleteOptionValue(
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

      if (skipValidationAndTransformation) {
        values[option.name] = value;
        continue;
      }

      // Check if the option has a validator
      let isValid = true;
      if (
        this.validatorsMap.has(option.name) &&
        interaction instanceof ChatInputCommandInteraction
      ) {
        // Run the validator
        const validator = this.validatorsMap.get(option.name);
        if (!validator)
          throw new Error(`Validator for ${option.name} not found`);
        try {
          const validateResult = await validator(interaction, value);
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
        const transformer = this.transformersMap.get(option.name);
        if (!transformer)
          throw new Error(`Transformer for ${option.name} not found`);
        value = await transformer(value);
      }

      // Add the value to the values object
      values[option.name] = value;
    }
    if (errors.length > 0) return errors;
    return values as CommandOptionsObject<T>;
  }
}

export function populateBuilder<
  T extends SlashCommandBuilder | SlashCommandSubcommandBuilder
>(info: ChatCommandOptions<[]>, builder: T) {
  builder
    .setName(info.name)
    .setNameLocalizations(info.nameLocalizations ?? null)
    .setDescription(info.description)
    .setDescriptionLocalizations(info.descriptionLocalizations ?? null);
  if (builder instanceof SlashCommandBuilder) {
    builder
      .setDefaultMemberPermissions(info.defaultMemberPermissions)
      .setDMPermission(info.dmPermission);
  }
  info.options.forEach((option: ApplicationCommandOptionData) => {
    let string,
      integer,
      boolean,
      user,
      channel,
      role,
      mentionable,
      number,
      attachment;
    switch (option.type) {
      case ApplicationCommandOptionType.String:
        string = new SlashCommandStringOption()
          .setName(option.name)
          .setNameLocalizations(option.nameLocalizations ?? null)
          .setDescription(option.description)
          .setDescriptionLocalizations(option.descriptionLocalizations ?? null)
          .setRequired(option.required ?? false)
          .setAutocomplete(option.autocomplete ?? false);
        if ('minLength' in option && option.minLength)
          string.setMinLength(option.minLength);
        if ('maxLength' in option && option.maxLength)
          string.setMaxLength(option.maxLength);
        if ('choices' in option && option.choices) {
          string.setChoices(
            ...option.choices.map((choice) => ({
              name: choice.name,
              name_localizations: choice.nameLocalizations ?? null,
              value: choice.value as string,
            }))
          );
        }
        builder.addStringOption(string);
        break;
      case ApplicationCommandOptionType.Integer:
        integer = new SlashCommandIntegerOption()
          .setName(option.name)
          .setNameLocalizations(option.nameLocalizations ?? null)
          .setDescription(option.description)
          .setDescriptionLocalizations(option.descriptionLocalizations ?? null)
          .setRequired(option.required ?? false)
          .setAutocomplete(option.autocomplete ?? false);
        if ('minValue' in option && option.minValue)
          integer.setMinValue(option.minValue);
        if ('maxValue' in option && option.maxValue)
          integer.setMaxValue(option.maxValue);
        if ('choices' in option && option.choices) {
          integer.setChoices(
            ...option.choices.map((choice) => ({
              name: choice.name,
              name_localizations: choice.nameLocalizations ?? null,
              value: choice.value as number,
            }))
          );
        }
        builder.addIntegerOption(integer);
        break;
      case ApplicationCommandOptionType.Boolean:
        boolean = new SlashCommandBooleanOption()
          .setName(option.name)
          .setNameLocalizations(option.nameLocalizations ?? null)
          .setDescription(option.description)
          .setDescriptionLocalizations(option.descriptionLocalizations ?? null)
          .setRequired(option.required ?? false);
        builder.addBooleanOption(boolean);
        break;
      case ApplicationCommandOptionType.User:
        user = new SlashCommandUserOption()
          .setName(option.name)
          .setNameLocalizations(option.nameLocalizations ?? null)
          .setDescription(option.description)
          .setDescriptionLocalizations(option.descriptionLocalizations ?? null)
          .setRequired(option.required ?? false);
        builder.addUserOption(user);
        break;
      case ApplicationCommandOptionType.Channel:
        channel = new SlashCommandChannelOption()
          .setName(option.name)
          .setNameLocalizations(option.nameLocalizations ?? null)
          .setDescription(option.description)
          .setDescriptionLocalizations(option.descriptionLocalizations ?? null)
          .setRequired(option.required ?? false);
        if (option.channelTypes) {
          channel.addChannelTypes(...option.channelTypes);
        }
        builder.addChannelOption(channel);
        break;
      case ApplicationCommandOptionType.Role:
        role = new SlashCommandRoleOption()
          .setName(option.name)
          .setNameLocalizations(option.nameLocalizations ?? null)
          .setDescription(option.description)
          .setDescriptionLocalizations(option.descriptionLocalizations ?? null)
          .setRequired(option.required ?? false);
        builder.addRoleOption(role);
        break;
      case ApplicationCommandOptionType.Mentionable:
        mentionable = new SlashCommandMentionableOption()
          .setName(option.name)
          .setNameLocalizations(option.nameLocalizations ?? null)
          .setDescription(option.description)
          .setDescriptionLocalizations(option.descriptionLocalizations ?? null)
          .setRequired(option.required ?? false);
        builder.addMentionableOption(mentionable);
        break;
      case ApplicationCommandOptionType.Number:
        number = new SlashCommandNumberOption()
          .setName(option.name)
          .setNameLocalizations(option.nameLocalizations ?? null)
          .setDescription(option.description)
          .setDescriptionLocalizations(option.descriptionLocalizations ?? null)
          .setRequired(option.required ?? false)
          .setAutocomplete(option.autocomplete ?? false);
        if ('minValue' in option && option.minValue)
          number.setMinValue(option.minValue);
        if ('maxValue' in option && option.maxValue)
          number.setMaxValue(option.maxValue);
        if ('choices' in option && option.choices) {
          number.setChoices(
            ...option.choices.map((choice) => ({
              name: choice.name,
              name_localizations: choice.nameLocalizations ?? null,
              value: choice.value as number,
            }))
          );
        }
        builder.addNumberOption(number);
        break;
      case ApplicationCommandOptionType.Attachment:
        attachment = new SlashCommandAttachmentOption()
          .setName(option.name)
          .setNameLocalizations(option.nameLocalizations ?? null)
          .setDescription(option.description)
          .setDescriptionLocalizations(option.descriptionLocalizations ?? null)
          .setRequired(option.required ?? false);
        builder.addAttachmentOption(attachment);
        break;
    }
  });
  return builder;
}