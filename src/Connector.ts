import {
  APIMessage,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import { PageInteractionReplyMessage } from './Page';
import { MessageData } from './SlashasaurusClient';

export interface Connector {
  getCommandGroup: (
    interaction: ConnectorTypes['ChatInputCommandInteraction']
  ) => string | undefined;
  getCommandSubcommand: (
    interaction: ConnectorTypes['ChatInputCommandInteraction']
  ) => string | undefined;

  getGuildMessage: (data: MessageData) => Promise<ConnectorTypes['Message']>;
  getDMMessage: (
    data: Omit<MessageData, 'guildId'>
  ) => Promise<ConnectorTypes['Message']>;

  getOptionValue: (
    interaction:
      | ConnectorTypes['ChatInputCommandInteraction']
      | ConnectorTypes['AutocompleteInteraction'],
    type: ApplicationCommandOptionType,
    name: string,
    required: boolean
  ) => any;

  createInteractionWebhook: (
    client: ConnectorTypes['Client'],
    appId: string,
    token: string
  ) => ConnectorTypes['InteractionWebhook'];

  getApplicationId: (client: ConnectorTypes['Client']) => string;

  messageToMessageData: (
    message: ConnectorTypes['Message'] | PageInteractionReplyMessage
  ) => string;

  replyToInteraction: (
    interaction: ConnectorTypes['Interaction'],
    data: Partial<APIMessage>
  ) => Promise<void>;
}
