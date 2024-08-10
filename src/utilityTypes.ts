import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteraction,
  APIAttachment,
  APIChannel,
  APIChatInputApplicationCommandInteraction,
  APIContextMenuInteraction,
  APIInteraction,
  APIMessage,
  APIMessageApplicationCommandInteraction,
  APIMessageChannelSelectInteractionData,
  APIMessageComponentButtonInteraction,
  APIMessageComponentInteraction,
  APIMessageComponentSelectMenuInteraction,
  APIMessageMentionableSelectInteractionData,
  APIMessageRoleSelectInteractionData,
  APIMessageUserSelectInteractionData,
  APIModalSubmitInteraction,
  APIRole,
  APIUser,
  APIUserApplicationCommandInteraction,
} from 'discord-api-types/v10';
import { APIInteractionDataResolvedChannel } from 'discord-api-types/v9';
import {
  ApplicationCommandOptionChoiceData,
  CategoryChannel,
  ChannelType,
  ForumChannel,
  NewsChannel,
  StageChannel,
  TextChannel,
  ThreadChannel,
  VoiceChannel,
} from 'discord.js';
import { ApplicationCommandOptionData, OptionsDataArray } from './OptionTypes';
import { SendablePage } from './Page';

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

export type GetConnectorType<T extends string> = T extends keyof ConnectorTypes
  ? ConnectorTypes[T]
  : T extends keyof DefaultConnectorTypes
  ? DefaultConnectorTypes[T]
  : never;

interface DefaultConnectorTypes {
  AutocompleteInteraction: APIApplicationCommandAutocompleteInteraction;
  ButtonInteraction: APIMessageComponentButtonInteraction;
  ChatInputCommandInteraction: APIChatInputApplicationCommandInteraction;
  Client: unknown;
  CommandInteraction: APIApplicationCommandInteraction;
  ContextMenuCommandInteraction: APIContextMenuInteraction;
  MessageContextMenuCommandInteraction: APIMessageApplicationCommandInteraction;
  UserContextMenuCommandInteraction: APIUserApplicationCommandInteraction;
  MessageComponentInteraction: APIMessageComponentInteraction;
  ModalSubmitInteraction: APIModalSubmitInteraction;
  SelectMenuInteraction: APIMessageComponentSelectMenuInteraction;
  UserSelectMenuInteraction: APIMessageUserSelectInteractionData;
  RoleSelectMenuInteraction: APIMessageRoleSelectInteractionData;
  ChannelSelectMenuInteraction: APIMessageChannelSelectInteractionData;
  MentionableSelectMenuInteraction: APIMessageMentionableSelectInteractionData;
  Message: APIMessage;
  Interaction: APIInteraction;
  OptionsMap: OptionsMap;
}

export interface ModifiableWebhook {
  /**
   * Takes a message id and the new message data and edits the message
   */
  editMessage: (id: string, data: SendablePage) => Promise<void>;
  /**
   * Takes a message id and deletes the message
   */
  deleteMessage: (id: string) => Promise<void>;
}

type HasChoices = {
  choices: readonly [
    ApplicationCommandOptionChoiceData,
    ...ApplicationCommandOptionChoiceData[]
  ];
};

export type GetOptionsMap = GetConnectorType<'OptionsMap'>;

type OptionsMap = {
  3: string;
  4: number;
  5: boolean;
  6: APIUser;
  7: APIChannel;
  8: APIRole;
  9: APIUser | APIRole;
  10: number;
  11: APIAttachment;
};

type ChannelsMap = {
  0: TextChannel;
  1: never; // DM
  2: VoiceChannel;
  3: never; // Group DM
  4: CategoryChannel;
  5: NewsChannel;
  10: ThreadChannel;
  11: ThreadChannel;
  12: ThreadChannel;
  13: StageChannel;
  14: never; // Directory
  15: ForumChannel; // Forum
};

type MapChannelTypesToChannels<T extends ReadonlyArray<ChannelType>> = {
  [K in keyof T]: T[K] extends ChannelType ? ChannelsMap[T[K]] : never;
}[number];

type OptionToValue<T extends ApplicationCommandOptionData> = T extends {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformer: (value: any) => unknown;
}
  ? Awaited<ReturnType<T['transformer']>>
  : T extends HasChoices
  ? MapChoicesToValues<T['choices']>
  : T extends {
      channelTypes: ReadonlyArray<ChannelType>;
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
