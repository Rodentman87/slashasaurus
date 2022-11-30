import type { LocalizationMap } from 'discord-api-types/v9';
import { ApplicationCommandOptionType } from 'discord-api-types/v10';
import {
  AutocompleteInteraction,
  CommandInteraction,
  ChannelType,
} from 'discord.js';
import { SlashasaurusClient } from './SlashasaurusClient';
import { MaybePromise, OptionsMap } from './utilityTypes';

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

// STRING
type StringChoiceResolvableType =
  | ApplicationCommandOptionType.String
  | 'STRING';

interface StringOptionsData extends BaseApplicationCommandOptionsData<string> {
  readonly type: StringChoiceResolvableType;
  readonly minLength?: number;
  readonly maxLength?: number;
}

interface StringChoiceOptionsData
  extends Omit<BaseApplicationCommandOptionsData<string>, 'autocomplete'> {
  readonly type: StringChoiceResolvableType;
  readonly choices:
    | readonly [
        ApplicationCommandOptionChoiceData<string>,
        ...ApplicationCommandOptionChoiceData<string>[]
      ];
  readonly autocomplete?: false;
}

interface StringAutocompleteOptionsData
  extends Omit<BaseApplicationCommandOptionsData<string>, 'autocomplete'> {
  readonly type: StringChoiceResolvableType;
  readonly autocomplete: true;
  readonly onAutocomplete?: (
    interaction: AutocompleteInteraction,
    value: string,
    client: SlashasaurusClient
  ) => void;
  readonly transformer?: (value: string) => unknown;
}

// INTEGER
type IntegerChoiceResolvableType =
  | ApplicationCommandOptionType.Integer
  | 'INTEGER';

interface IntegerOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: IntegerChoiceResolvableType;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly autocomplete?: false;
}

interface IntegerChoiceOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: IntegerChoiceResolvableType;
  readonly choices:
    | readonly [
        ApplicationCommandOptionChoiceData<number>,
        ...ApplicationCommandOptionChoiceData<number>[]
      ];
  readonly autocomplete?: false;
}

interface IntegerAutocompleteOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: IntegerChoiceResolvableType;
  readonly autocomplete: true;
  readonly onAutocomplete?: (
    interaction: AutocompleteInteraction,
    value: number,
    client: SlashasaurusClient
  ) => void;
  readonly transformer?: (value: number) => unknown;
}

// BOOLEAN
type BooleanChoiceResolvableType =
  | ApplicationCommandOptionType.Boolean
  | 'BOOLEAN';

interface BooleanOptionsData
  extends BaseApplicationCommandOptionsData<boolean> {
  readonly type: BooleanChoiceResolvableType;
}

// USER
type UserChoiceResolvableType = ApplicationCommandOptionType.User | 'USER';

interface UserOptionsData
  extends BaseApplicationCommandOptionsData<OptionsMap['USER']> {
  readonly type: UserChoiceResolvableType;
}

// CHANNEL
type ChannelChoiceResolvableType =
  | ApplicationCommandOptionType.Channel
  | 'CHANNEL';

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
  extends BaseApplicationCommandOptionsData<OptionsMap['CHANNEL']> {
  readonly type: ChannelChoiceResolvableType;
  readonly channelTypes?: ReadonlyArray<ValidChannelTypes>;
}

// ROLE
type RoleChoiceResolvableType = ApplicationCommandOptionType.Role | 'ROLE';

interface RoleOptionsData
  extends BaseApplicationCommandOptionsData<OptionsMap['ROLE']> {
  readonly type: RoleChoiceResolvableType;
}

// MENTIONABLE
type MentionableChoiceResolvableType =
  | ApplicationCommandOptionType.Mentionable
  | 'MENTIONABLE';

interface MentionableOptionsData
  extends BaseApplicationCommandOptionsData<OptionsMap['MENTIONABLE']> {
  readonly type: MentionableChoiceResolvableType;
}

// NUMBER
type NumberChoiceResolvableType =
  | ApplicationCommandOptionType.Number
  | 'NUMBER';

interface NumberOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: NumberChoiceResolvableType;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly autocomplete?: false;
}

interface NumberChoiceOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: NumberChoiceResolvableType;
  readonly choices:
    | readonly [
        ApplicationCommandOptionChoiceData<number>,
        ...ApplicationCommandOptionChoiceData<number>[]
      ];
  readonly autocomplete?: false;
}

interface NumberAutocompleteOptionsData
  extends Omit<BaseApplicationCommandOptionsData<number>, 'autocomplete'> {
  readonly type: NumberChoiceResolvableType;
  readonly autocomplete: true;
  readonly onAutocomplete?: (
    interaction: AutocompleteInteraction,
    value: number,
    client: SlashasaurusClient
  ) => void;
  readonly transformer?: (value: number) => unknown;
}

// ATTACHMENT
type AttachmentChoiceResolvableType =
  | ApplicationCommandOptionType.Attachment
  | 'ATTACHMENT';

interface AttachmentOptionsData
  extends BaseApplicationCommandOptionsData<OptionsMap['ATTACHMENT']> {
  readonly type: AttachmentChoiceResolvableType;
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
