import {
  APIMessage,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import { GetConnectorType } from './utilityTypes';

export interface Connector {
  getCommandGroup: (
    interaction: GetConnectorType<'ChatInputCommandInteraction'>
  ) => string | undefined;
  getCommandSubcommand: (
    interaction: GetConnectorType<'ChatInputCommandInteraction'>
  ) => string | undefined;

  // getGuildMessage: (data: MessageData) => Promise<GetConnectorType<'Message'>>;
  // getDMMessage: (
  //   data: Omit<MessageData, 'guildId'>
  // ) => Promise<GetConnectorType<'Message'>>;

  getOptionValue: (
    interaction: GetConnectorType<'ChatInputCommandInteraction'>,
    type: ApplicationCommandOptionType,
    name: string,
    required: boolean
  ) => any;
  getAutocompleteOptionValue: (
    interaction: GetConnectorType<'AutocompleteInteraction'>,
    type: ApplicationCommandOptionType,
    name: string,
    required: boolean
  ) => any;

  // createInteractionWebhook: (
  //   client: GetConnectorType<'Client'>,
  //   appId: string,
  //   token: string
  // ) => GetConnectorType<'InteractionWebhook'>;

  getApplicationId: (client: GetConnectorType<'Client'>) => string;

  // messageToMessageData: (
  //   message: GetConnectorType<'Message'> | PageInteractionReplyMessage
  // ) => string;

  replyToInteraction: (
    interaction:
      | GetConnectorType<'ChatInputCommandInteraction'>
      | GetConnectorType<'MessageComponentInteraction'>,
    data: Partial<APIMessage>
  ) => Promise<void>;
}
