import {
  ApplicationCommandOptionChoice,
  ApplicationCommandOptionData,
  CommandOptionChoiceResolvableType,
  GuildChannel,
  GuildMember,
  Role,
  User,
} from 'discord.js';
import {
  RawGuildChannelData,
  RawRoleData,
  RawUserData,
} from 'discord.js/typings/rawDataTypes';

export type PropType<TObj, TProp extends keyof TObj> = TObj[TProp];
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

type MapChoicesToValues<T extends Array<ApplicationCommandOptionChoice>> =
  Length<T> extends 1
    ? PropType<Head<T>, 'value'>
    : PropType<Head<T>, 'value'> | MapChoicesToValues<Tail<T>>;

type HasChoices = {
  type: CommandOptionChoiceResolvableType;
  choices: ApplicationCommandOptionChoice[];
};

type OptionToValue<T extends ApplicationCommandOptionData> = PropType<
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
  ? User | RawUserData
  : PropType<T, 'type'> extends 'CHANNEL'
  ? GuildChannel | RawGuildChannelData
  : PropType<T, 'type'> extends 'ROLE'
  ? Role | RawRoleData
  : PropType<T, 'type'> extends 'MENTIONABLE'
  ? User | RawUserData | GuildMember | Role | RawRoleData
  : PropType<T, 'type'> extends 'NUMBER'
  ? T extends HasChoices
    ? MapChoicesToValues<PropType<T, 'choices'>>
    : number
  : null;

type MapOptionToKeyedObject<T extends ApplicationCommandOptionData> = PropType<
  T,
  'required'
> extends true
  ? {
      [K in PropType<T, 'name'>]: OptionToValue<T>;
    }
  : {
      [K in PropType<T, 'name'>]?: OptionToValue<T>;
    };

export type CommandOptionsObject<
  T extends Array<ApplicationCommandOptionData>
> = Length<T> extends 0
  ? {}
  : Length<T> extends 1
  ? MapOptionToKeyedObject<Head<T>>
  : MapOptionToKeyedObject<Head<T>> & CommandOptionsObject<Tail<T>>;

export type ReadonlyCommandOptionsObject<
  T extends ReadonlyArray<ApplicationCommandOptionData>
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

type MapOptionToAutocompleteName<T extends ApplicationCommandOptionData> =
  T extends { autocomplete: true } ? PropType<T, 'name'> : never;

export type MapOptionsToAutocompleteNames<
  T extends ReadonlyArray<ApplicationCommandOptionData>
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

type AddReadOnly<T> = {
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
