import {
  ApplicationCommandOptionChoice,
  AutocompleteInteraction,
  CommandInteractionOption,
  CommandOptionChannelResolvableType,
  CommandOptionChoiceResolvableType,
  CommandOptionNonChoiceResolvableType,
  CommandOptionNumericResolvableType,
  ExcludeEnum,
} from 'discord.js';
import {
  ApplicationCommandOptionTypes,
  ChannelTypes,
} from 'discord.js/typings/enums';
import { SlashasaurusClient } from './SlashasaurusClient';

export type ExtractArrayType<T> = ((a: T) => any) extends (
  a: Array<infer H>
) => any
  ? H
  : never;

type LengthOfReadonly<T extends Readonly<any[]>> = T['length'];
type HeadOfReadonly<T extends Readonly<any[]>> = T extends [] ? never : T[0];
type TailOfReadonly<T extends Readonly<any[]>> = ((
  ...array: T
) => any) extends (head: any, ...tail: infer Tail_) => any
  ? Tail_
  : never;

type MapChoicesToValues<T extends readonly ApplicationCommandOptionChoice[]> = {
  [K in keyof T]: T[K] extends ApplicationCommandOptionChoice
    ? T[K]['value']
    : never;
}[number];

type HasChoices = {
  choices: readonly [
    ApplicationCommandOptionChoice,
    ...ApplicationCommandOptionChoice[]
  ];
};

type OptionsMap = {
  STRING: string;
  3: string;
  INTEGER: number;
  4: number;
  BOOLEAN: boolean;
  5: boolean;
  USER: NonNullable<CommandInteractionOption['user']>;
  6: NonNullable<CommandInteractionOption['user']>;
  CHANNEL: NonNullable<CommandInteractionOption['channel']>;
  7: NonNullable<CommandInteractionOption['channel']>;
  ROLE: NonNullable<CommandInteractionOption['role']>;
  8: NonNullable<CommandInteractionOption['role']>;
  MENTIONABLE: NonNullable<
    CommandInteractionOption['member' | 'role' | 'user']
  >;
  9: NonNullable<CommandInteractionOption['member' | 'role' | 'user']>;
  NUMBER: number;
  10: number;
};

type OptionToValue<T extends ReadonlyApplicationCommandOptionData> =
  T extends HasChoices
    ? MapChoicesToValues<T['choices']>
    : OptionsMap[T['type']];

export type CommandOptionsObject<T extends OptionsDataArray> = {
  [Key in T[number]['name']]: Extract<
    T[number],
    { name: Key }
  >['required'] extends true
    ? OptionToValue<Extract<T[number], { name: Key }>>
    : OptionToValue<Extract<T[number], { name: Key }>> | null;
};

type MapOptionToAutocompleteName<
  T extends ReadonlyApplicationCommandOptionData
> = T extends { autocomplete: true }
  ? T extends {
      onAutocomplete: Function;
    }
    ? never
    : T['name']
  : never;

export type MapOptionsToAutocompleteNames<
  T extends readonly ReadonlyApplicationCommandOptionData[]
> = LengthOfReadonly<T> extends 0
  ? never
  : LengthOfReadonly<T> extends 1
  ? MapOptionToAutocompleteName<HeadOfReadonly<T>>
  :
      | MapOptionToAutocompleteName<HeadOfReadonly<T>>
      | MapOptionsToAutocompleteNames<TailOfReadonly<T>>;

interface ReadonlyBaseApplicationCommandOptionsData {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
  readonly autocomplete?: never;
}

interface ReadonlyApplicationCommandNonOptionsData
  extends ReadonlyBaseApplicationCommandOptionsData {
  readonly type: CommandOptionNonChoiceResolvableType;
}

interface ReadonlyApplicationCommandChannelOptionData
  extends ReadonlyBaseApplicationCommandOptionsData {
  readonly type: CommandOptionChannelResolvableType;
  readonly channelTypes?: ExcludeEnum<typeof ChannelTypes, 'UNKNOWN'>[];
  readonly channel_types?: Exclude<ChannelTypes, ChannelTypes.UNKNOWN>[];
}

interface ReadonlyApplicationCommandChoicesData
  extends Omit<ReadonlyBaseApplicationCommandOptionsData, 'autocomplete'> {
  readonly type: CommandOptionChoiceResolvableType;
  readonly choices?:
    | readonly [
        ApplicationCommandOptionChoice,
        ...ApplicationCommandOptionChoice[]
      ];
  readonly autocomplete?: false;
}

type AutocompletableTypes =
  | 'STRING'
  | 'NUMBER'
  | 'INTEGER'
  | ApplicationCommandOptionTypes.STRING
  | ApplicationCommandOptionTypes.NUMBER
  | ApplicationCommandOptionTypes.INTEGER;

interface ReadonlyApplicationCommandAutocompleteOption
  extends Omit<ReadonlyBaseApplicationCommandOptionsData, 'autocomplete'> {
  readonly type: AutocompletableTypes;
  readonly autocomplete: true;
  readonly onAutocomplete?: (
    interaction: AutocompleteInteraction,
    value: string | number,
    client: SlashasaurusClient
  ) => void;
}

interface ReadonlyApplicationCommandNumericOptionData
  extends ReadonlyBaseApplicationCommandOptionsData {
  readonly type: CommandOptionNumericResolvableType;
  readonly minValue?: number;
  readonly min_value?: number;
  readonly maxValue?: number;
  readonly max_value?: number;
}

export type ReadonlyApplicationCommandOptionData =
  | ReadonlyApplicationCommandNonOptionsData
  | ReadonlyApplicationCommandChannelOptionData
  | ReadonlyApplicationCommandChoicesData
  | ReadonlyApplicationCommandAutocompleteOption
  | ReadonlyApplicationCommandNumericOptionData;

export type OptionsDataArray =
  | readonly [
      ReadonlyApplicationCommandOptionData,
      ...ReadonlyApplicationCommandOptionData[]
    ]
  | readonly [];
