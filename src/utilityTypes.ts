import { APIInteractionDataResolvedChannel } from 'discord-api-types/v9';
import {
  ApplicationCommandOptionChoiceData,
  CategoryChannel,
  CommandInteractionOptionResolver,
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

export type ExtractArrayType<T> = ((a: T) => never) extends (
  a: Array<infer H>
) => never
  ? H
  : never;

export type MaybePromise<T> = T | Promise<T>;

type LengthOfReadonly<T extends Readonly<unknown[]>> = T['length'];
type HeadOfReadonly<T extends Readonly<unknown[]>> = T extends []
  ? never
  : T[0];
type TailOfReadonly<T extends Readonly<unknown[]>> = ((
  ...array: T
) => never) extends (head: never, ...tail: infer Tail_) => never
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

type CommandInteractionOptionResolverReturn<
  T extends keyof CommandInteractionOptionResolver
  // eslint-disable-next-line @typescript-eslint/ban-types
> = CommandInteractionOptionResolver[T] extends Function
  ? // @ts-expect-error this works, it just doesn't narrow the type here
    NonNullable<ReturnType<CommandInteractionOptionResolver[T]>>
  : never;

export type OptionsMap = {
  STRING: CommandInteractionOptionResolverReturn<'getString'>;
  3: CommandInteractionOptionResolverReturn<'getString'>;
  INTEGER: CommandInteractionOptionResolverReturn<'getInteger'>;
  4: CommandInteractionOptionResolverReturn<'getInteger'>;
  BOOLEAN: CommandInteractionOptionResolverReturn<'getBoolean'>;
  5: CommandInteractionOptionResolverReturn<'getBoolean'>;
  USER:
    | CommandInteractionOptionResolverReturn<'getMember'>
    | CommandInteractionOptionResolverReturn<'getUser'>;
  6:
    | CommandInteractionOptionResolverReturn<'getMember'>
    | CommandInteractionOptionResolverReturn<'getUser'>;
  CHANNEL: CommandInteractionOptionResolverReturn<'getChannel'>;
  7: CommandInteractionOptionResolverReturn<'getChannel'>;
  ROLE: CommandInteractionOptionResolverReturn<'getRole'>;
  8: CommandInteractionOptionResolverReturn<'getRole'>;
  MENTIONABLE:
    | CommandInteractionOptionResolverReturn<'getMember'>
    | CommandInteractionOptionResolverReturn<'getRole'>
    | CommandInteractionOptionResolverReturn<'getUser'>;
  9:
    | CommandInteractionOptionResolverReturn<'getMember'>
    | CommandInteractionOptionResolverReturn<'getRole'>
    | CommandInteractionOptionResolverReturn<'getUser'>;
  NUMBER: CommandInteractionOptionResolverReturn<'getInteger'>;
  10: CommandInteractionOptionResolverReturn<'getInteger'>;
  ATTACHMENT: CommandInteractionOptionResolverReturn<'getAttachment'>;
  11: CommandInteractionOptionResolverReturn<'getAttachment'>;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/ban-types
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
