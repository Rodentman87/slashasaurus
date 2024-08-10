import { ApplicationCommandOptionType } from 'discord-api-types/v10';
import type { LocalizationMap } from 'discord-api-types/v9';
import { ChannelType, CommandInteraction } from 'discord.js';
import { SlashasaurusClient } from './SlashasaurusClient';
import { GetConnectorType, GetOptionsMap, MaybePromise } from './utilityTypes';

interface BaseApplicationCommandOptionsData<T> {
  /**
   * The name of the option.
   */
  readonly name: string;
  /**
   * An object of localizations for the option name.
   */
  readonly nameLocalizations?: LocalizationMap;
  /**
   * The description of the option.
   */
  readonly description: string;
  /**
   * An object of localizations for the option description.
   */
  readonly descriptionLocalizations?: LocalizationMap;
  /**
   * Whether this option is required.
   */
  readonly required?: boolean;
  readonly autocomplete?: never;
  /**
   * A custom validator for the option. This will only run before the command's run handler is called.
   * If the validator returns a string or throws a {@link ValidationError}, that will be used as the error message.
   * All errors will be displayed to the user as a list.
   */
  readonly validator?: (
    interaction: CommandInteraction,
    value: T
  ) => MaybePromise<boolean | string>;
}

interface ApplicationCommandOptionChoiceData<T extends string | number> {
  name: string;
  nameLocalizations?: LocalizationMap;
  value: T;
}

interface StringOptionsData extends BaseApplicationCommandOptionsData<string> {
  readonly type: ApplicationCommandOptionType.String;
  readonly minLength?: number;
  readonly maxLength?: number;
}

interface StringChoiceOptionsData
  extends Omit<BaseApplicationCommandOptionsData<string>, 'autocomplete'> {
  readonly type: ApplicationCommandOptionType.String;
  readonly choices:
    | readonly [
        ApplicationCommandOptionChoiceData<string>,
        ...ApplicationCommandOptionChoiceData<string>[]
      ];
  readonly autocomplete?: false;
}

interface StringAutocompleteOptionsData
  extends Omit<BaseApplicationCommandOptionsData<string>, 'autocomplete'> {
  readonly type: ApplicationCommandOptionType.String;
  readonly autocomplete: true;
  readonly onAutocomplete?: (
    interaction: GetConnectorType<'AutocompleteInteraction'>,
    value: string,
    client: SlashasaurusClient
  ) => void;
  readonly transformer?: (value: string) => unknown;
}

interface IntegerOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: ApplicationCommandOptionType.Integer;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly autocomplete?: false;
}

interface IntegerChoiceOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: ApplicationCommandOptionType.Integer;
  readonly choices:
    | readonly [
        ApplicationCommandOptionChoiceData<number>,
        ...ApplicationCommandOptionChoiceData<number>[]
      ];
  readonly autocomplete?: false;
}

interface IntegerAutocompleteOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: ApplicationCommandOptionType.Integer;
  readonly autocomplete: true;
  readonly onAutocomplete?: (
    interaction: GetConnectorType<'AutocompleteInteraction'>,
    value: number,
    client: SlashasaurusClient
  ) => void;
  readonly transformer?: (value: number) => unknown;
}

interface BooleanOptionsData
  extends BaseApplicationCommandOptionsData<boolean> {
  readonly type: ApplicationCommandOptionType.Boolean;
}

interface UserOptionsData
  extends BaseApplicationCommandOptionsData<
    GetOptionsMap[ApplicationCommandOptionType.User]
  > {
  readonly type: ApplicationCommandOptionType.User;
}

type ValidChannelTypes =
  | ChannelType.GuildText
  | ChannelType.GuildVoice
  | ChannelType.GuildCategory
  | ChannelType.GuildNews
  | ChannelType.GuildNewsThread
  | ChannelType.GuildPublicThread
  | ChannelType.GuildPrivateThread
  | ChannelType.GuildStageVoice
  | ChannelType.GuildForum;

interface ChannelOptionsData
  extends BaseApplicationCommandOptionsData<
    GetOptionsMap[ApplicationCommandOptionType.Channel]
  > {
  readonly type: ApplicationCommandOptionType.Channel;
  readonly channelTypes?: ReadonlyArray<ValidChannelTypes>;
}

interface RoleOptionsData
  extends BaseApplicationCommandOptionsData<
    GetOptionsMap[ApplicationCommandOptionType.Role]
  > {
  readonly type: ApplicationCommandOptionType.Role;
}

interface MentionableOptionsData
  extends BaseApplicationCommandOptionsData<
    GetOptionsMap[ApplicationCommandOptionType.Mentionable]
  > {
  readonly type: ApplicationCommandOptionType.Mentionable;
}

interface NumberOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: ApplicationCommandOptionType.Number;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly autocomplete?: false;
}

interface NumberChoiceOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: ApplicationCommandOptionType.Number;
  readonly choices:
    | readonly [
        ApplicationCommandOptionChoiceData<number>,
        ...ApplicationCommandOptionChoiceData<number>[]
      ];
  readonly autocomplete?: false;
}

interface NumberAutocompleteOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: ApplicationCommandOptionType.Number;
  readonly autocomplete: true;
  readonly onAutocomplete?: (
    interaction: GetConnectorType<'AutocompleteInteraction'>,
    value: number,
    client: SlashasaurusClient
  ) => void;
  readonly transformer?: (value: number) => unknown;
}

interface AttachmentOptionsData
  extends BaseApplicationCommandOptionsData<
    GetOptionsMap[ApplicationCommandOptionType.Attachment]
  > {
  readonly type: ApplicationCommandOptionType.Attachment;
}

export type ApplicationCommandOptionData =
  | StringOptionsData
  | StringChoiceOptionsData
  | StringAutocompleteOptionsData
  | IntegerOptionsData
  | IntegerChoiceOptionsData
  | IntegerAutocompleteOptionsData
  | BooleanOptionsData
  | UserOptionsData
  | ChannelOptionsData
  | RoleOptionsData
  | MentionableOptionsData
  | NumberOptionsData
  | NumberChoiceOptionsData
  | NumberAutocompleteOptionsData
  | AttachmentOptionsData;

export type OptionsDataArray =
  | readonly [ApplicationCommandOptionData, ...ApplicationCommandOptionData[]]
  | readonly [];
