import {
  ApplicationCommandOptionChoice,
  ApplicationCommandOptionData,
  CacheType,
  CommandInteractionOption,
  CommandOptionChannelResolvableType,
  CommandOptionChoiceResolvableType,
  CommandOptionNonChoiceResolvableType,
  CommandOptionNumericResolvableType,
  ExcludeEnum,
  User,
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

type Length<T extends any[]> = T['length'];
type LengthOfReadonly<T extends Readonly<any[]>> = T['length'];
type Head<T extends any[]> = T extends [] ? never : T[0];
type HeadOfReadonly<T extends Readonly<any[]>> = T extends [] ? never : T[0];
type Tail<T extends any[]> = ((...array: T) => any) extends (
  head: any,
  ...tail: infer Tail_
) => any
  ? Tail_
  : never;
type TailOfReadonly<T extends Readonly<any[]>> = ((
  ...array: T
) => any) extends (head: any, ...tail: infer Tail_) => any
  ? Tail_
  : never;

type MapChoicesToValues<
  T extends ReadonlyArray<ApplicationCommandOptionChoice>
> = LengthOfReadonly<T> extends 1
  ? PropType<HeadOfReadonly<T>, 'value'>
  :
      | PropType<HeadOfReadonly<T>, 'value'>
      | MapChoicesToValues<TailOfReadonly<T>>;

type HasChoices = {
  type: CommandOptionChoiceResolvableType;
  choices: ReadonlyArray<ApplicationCommandOptionChoice>;
};

type OptionToValue<
  T extends ReadonlyApplicationCommandOptionData,
  Cached extends CacheType = CacheType
> = PropType<T, 'type'> extends 'STRING'
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
  ? User
  : PropType<T, 'type'> extends 'CHANNEL'
  ? NonNullable<CommandInteractionOption<Cached>['channel']>
  : PropType<T, 'type'> extends 'ROLE'
  ? NonNullable<CommandInteractionOption<Cached>['role']>
  : PropType<T, 'type'> extends 'MENTIONABLE'
  ? NonNullable<CommandInteractionOption<Cached>['member' | 'role' | 'user']>
  : PropType<T, 'type'> extends 'NUMBER'
  ? T extends HasChoices
    ? MapChoicesToValues<PropType<T, 'choices'>>
    : number
  : null;

type MapOptionToKeyedObject<
  T extends ReadonlyApplicationCommandOptionData,
  Cached extends CacheType = CacheType
> = T extends { required?: boolean }
  ? PropType<T, 'required'> extends true
    ? {
        [K in PropType<T, 'name'>]: OptionToValue<T, Cached>;
      }
    : {
        [K in PropType<T, 'name'>]: OptionToValue<T, Cached> | null;
      }
  : {
      [K in PropType<T, 'name'>]: OptionToValue<T, Cached>;
    };

export type CommandOptionsObject<
  T extends Array<ReadonlyApplicationCommandOptionData>
> = Length<T> extends 0
  ? {}
  : Length<T> extends 1
  ? MapOptionToKeyedObject<Head<T>>
  : MapOptionToKeyedObject<Head<T>> & CommandOptionsObject<Tail<T>>;

export type ReadonlyCommandOptionsObject<
  T extends ReadonlyArray<ReadonlyApplicationCommandOptionData>
> = LengthOfReadonly<T> extends 0
  ? {}
  : LengthOfReadonly<T> extends 1
  ? MapOptionToKeyedObject<HeadOfReadonly<T>>
  : MapOptionToKeyedObject<HeadOfReadonly<T>> &
      CommandOptionsObject<TailOfReadonly<T>>;

export type OptionsConstToType<
  // @ts-ignore
  T extends NestedReadonlyArray<Array<ApplicationCommandOptionData>>
> = RemoveNestedReadonlyFromArray<T>;

type MapOptionToAutocompleteName<
  T extends ReadonlyApplicationCommandOptionData
> = T extends { autocomplete: true } ? PropType<T, 'name'> : never;

export type MapOptionsToAutocompleteNames<
  T extends ReadonlyArray<ReadonlyApplicationCommandOptionData>
> = LengthOfReadonly<T> extends 0
  ? never
  : LengthOfReadonly<T> extends 1
  ? MapOptionToAutocompleteName<HeadOfReadonly<T>>
  :
      | MapOptionToAutocompleteName<HeadOfReadonly<T>>
      | MapOptionsToAutocompleteNames<TailOfReadonly<T>>;

// ==========================
// Taken from https://stackoverflow.com/a/55128956/7595722
// ==========================

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;
type LastOf<T> = UnionToIntersection<
  T extends any ? () => T : never
> extends () => infer R
  ? R
  : never;

type Push<T extends any[], V> = [...T, V];

export type TuplifyUnion<
  T,
  L = LastOf<T>,
  N = [T] extends [never] ? true : false
> = true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>;

type RemoveReadOnly<T> = {
  -readonly [K in keyof T]: T[K] extends Readonly<any[]>
    ? RemoveNestedReadonlyFromArray<T[K]>
    : T[K];
};

export type AddReadOnly<T> = {
  readonly [K in keyof T]: T[K] extends any[]
    ? NestedReadonlyArray<T[K]>
    : T[K];
};

type RemoveNestedReadonlyFromArray<T extends Readonly<Array<any>>> =
  LengthOfReadonly<T> extends 1
    ? [RemoveReadOnly<HeadOfReadonly<T>>]
    : [
        RemoveReadOnly<HeadOfReadonly<T>>,
        ...RemoveNestedReadonlyFromArray<TailOfReadonly<T>>
      ];

type NestedReadonlyArray<T extends any[]> = Length<T> extends 1
  ? [AddReadOnly<Head<T>>]
  : [AddReadOnly<Head<T>>, ...NestedReadonlyArray<Tail<T>>];

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
