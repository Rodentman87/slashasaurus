import { APIInteractionDataResolvedChannel } from 'discord-api-types/v9';
import {
  ApplicationCommandOptionChoiceData,
  CategoryChannel,
  CommandInteractionOption,
  ExcludeEnum,
  NewsChannel,
  StageChannel,
  StoreChannel,
  TextChannel,
  ThreadChannel,
  VoiceChannel,
} from 'discord.js';
import { ChannelTypes } from 'discord.js/typings/enums';
import { OptionsDataArray, ApplicationCommandOptionData } from './OptionTypes';

export type ExtractArrayType<T> = ((a: T) => any) extends (
  a: Array<infer H>
) => any
  ? H
  : never;

export type MaybePromise<T> = T | Promise<T>;

type LengthOfReadonly<T extends Readonly<any[]>> = T['length'];
type HeadOfReadonly<T extends Readonly<any[]>> = T extends [] ? never : T[0];
type TailOfReadonly<T extends Readonly<any[]>> = ((
  ...array: T
) => any) extends (head: any, ...tail: infer Tail_) => any
  ? Tail_
  : never;

type MapChoicesToValues<
  T extends readonly ApplicationCommandOptionChoiceData[]
> = {
  [K in keyof T]: T[K] extends ApplicationCommandOptionChoiceData
    ? T[K]['value']
    : never;
}[number];

type HasChoices = {
  choices: readonly [
    ApplicationCommandOptionChoiceData,
    ...ApplicationCommandOptionChoiceData[]
  ];
};

export type OptionsMap = {
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
  ATTACHMENT: NonNullable<CommandInteractionOption['attachment']>;
  11: NonNullable<CommandInteractionOption['attachment']>;
};

type ChannelsMap = {
  GUILD_TEXT: TextChannel;
  0: TextChannel;
  DM: never;
  1: never;
  GUILD_VOICE: VoiceChannel;
  2: VoiceChannel;
  GROUP_DM: never;
  3: never;
  GUILD_CATEGORY: CategoryChannel;
  4: CategoryChannel;
  GUILD_NEWS: NewsChannel;
  5: NewsChannel;
  GUILD_STORE: StoreChannel;
  6: StoreChannel;
  GUILD_NEWS_THREAD: ThreadChannel;
  10: ThreadChannel;
  GUILD_PUBLIC_THREAD: ThreadChannel;
  11: ThreadChannel;
  GUILD_PRIVATE_THREAD: ThreadChannel;
  12: ThreadChannel;
  GUILD_STAGE_VOICE: StageChannel;
  13: StageChannel;
  GUILD_DIRECTORY: never;
  14: never;
};

type MapChannelTypesToChannels<
  T extends ReadonlyArray<ExcludeEnum<typeof ChannelTypes, 'UNKNOWN'>>
> = {
  [K in keyof T]: T[K] extends ExcludeEnum<typeof ChannelTypes, 'UNKNOWN'>
    ? ChannelsMap[T[K]]
    : never;
}[number];

type OptionToValue<T extends ApplicationCommandOptionData> = T extends {
  transformer: (value: any) => unknown;
}
  ? Awaited<ReturnType<T['transformer']>>
  : T extends HasChoices
  ? MapChoicesToValues<T['choices']>
  : T extends {
      channelTypes: ReadonlyArray<ExcludeEnum<typeof ChannelTypes, 'UNKNOWN'>>;
    }
  ?
      | MapChannelTypesToChannels<T['channelTypes']>
      | APIInteractionDataResolvedChannel
  : OptionsMap[T['type']];

export type CommandOptionsObject<T extends OptionsDataArray> = {
  [Key in T[number]['name']]: Extract<
    T[number],
    { name: Key }
  >['required'] extends true
    ? OptionToValue<Extract<T[number], { name: Key }>>
    : OptionToValue<Extract<T[number], { name: Key }>> | null;
};

type MapOptionToAutocompleteName<T extends ApplicationCommandOptionData> =
  T extends { autocomplete: true }
    ? T extends {
        onAutocomplete: Function;
      }
      ? never
      : T['name']
    : never;

export type MapOptionsToAutocompleteNames<
  T extends readonly ApplicationCommandOptionData[]
> = LengthOfReadonly<T> extends 0
  ? never
  : LengthOfReadonly<T> extends 1
  ? MapOptionToAutocompleteName<HeadOfReadonly<T>>
  :
      | MapOptionToAutocompleteName<HeadOfReadonly<T>>
      | MapOptionsToAutocompleteNames<TailOfReadonly<T>>;
