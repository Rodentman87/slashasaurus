import {
  ApplicationCommandOptionChoice,
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

export type PropType<TObj, TProp extends keyof TObj> = TObj[TProp];
export type HasProp<TObj, TProp> = TProp extends keyof TObj ? true : false;
export type HasKey<
  T,
  Key extends string | number | symbol
> = keyof T extends Key ? true : false;
export type ExtractDefinedType<T> = ((a: T) => any) extends (
  a: infer H | undefined
) => any
  ? H
  : never;
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

type MapChoicesToValues<
  T extends ReadonlyArray<ApplicationCommandOptionChoice>
> = LengthOfReadonly<T> extends 0
  ? never
  : LengthOfReadonly<T> extends 1
  ? PropType<HeadOfReadonly<T>, 'value'>
  :
      | PropType<HeadOfReadonly<T>, 'value'>
      | MapChoicesToValues<TailOfReadonly<T>>;

type HasChoices = {
  type: CommandOptionChoiceResolvableType;
  choices: ReadonlyArray<ApplicationCommandOptionChoice>;
};

type OptionToValue<T extends ReadonlyApplicationCommandOptionData> = PropType<
  T,
  'type'
> extends 'STRING'
  ? T extends HasChoices
    ? MapChoicesToValues<PropType<T, 'choices'>>
    : string
  : PropType<T, 'type'> extends 'INTEGER'
  ? T extends HasChoices
    ? MapChoicesToValues<PropType<T, 'choices'>>
    : number
  : PropType<T, 'type'> extends 'BOOLEAN'
  ? boolean
  : PropType<T, 'type'> extends 'USER'
  ? NonNullable<CommandInteractionOption['user']>
  : PropType<T, 'type'> extends 'CHANNEL'
  ? NonNullable<CommandInteractionOption['channel']>
  : PropType<T, 'type'> extends 'ROLE'
  ? NonNullable<CommandInteractionOption['role']>
  : PropType<T, 'type'> extends 'MENTIONABLE'
  ? NonNullable<CommandInteractionOption['member' | 'role' | 'user']>
  : PropType<T, 'type'> extends 'NUMBER'
  ? T extends HasChoices
    ? MapChoicesToValues<PropType<T, 'choices'>>
    : number
  : null;

type MapOptionToKeyedObject<T extends ReadonlyApplicationCommandOptionData> =
  T extends { required?: boolean }
    ? PropType<T, 'required'> extends true
      ? OptionToValue<T>
      : OptionToValue<T> | null
    : OptionToValue<T>;

export type CommandOptionsObject<T extends OptionsDataArray> = {
  [Key in T[number]['name']]: MapOptionToKeyedObject<
    Extract<T[number], { name: Key }>
  >;
};

type MapOptionToAutocompleteName<
  T extends ReadonlyApplicationCommandOptionData
> = T extends { autocomplete: true } ? PropType<T, 'name'> : never;

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
  readonly choices?: ReadonlyArray<ApplicationCommandOptionChoice>;
  readonly autocomplete?: false;
}

interface ReadonlyApplicationCommandAutocompleteOption
  extends Omit<ReadonlyBaseApplicationCommandOptionsData, 'autocomplete'> {
  readonly type:
    | 'STRING'
    | 'NUMBER'
    | 'INTEGER'
    | ApplicationCommandOptionTypes.STRING
    | ApplicationCommandOptionTypes.NUMBER
    | ApplicationCommandOptionTypes.INTEGER;
  readonly autocomplete: true;
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
