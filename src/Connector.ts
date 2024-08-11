import {
  APIMessage,
  ApplicationCommandOptionType,
  RESTPatchAPIChannelMessageJSONBody,
} from 'discord-api-types/v10';
import { ComparableMessage, SendablePage } from './Page';
import { InteractionMessageData, MessageData } from './SlashasaurusClient';
import { GetConnectorType, ModifiableWebhook } from './utilityTypes';

export interface Connector {
  getCommandGroup: (
    interaction: GetConnectorType<'ChatInputCommandInteraction'>
  ) => string | undefined;
  getCommandSubcommand: (
    interaction: GetConnectorType<'ChatInputCommandInteraction'>
  ) => string | undefined;

  deleteMessage: (
    messageData: MessageData | InteractionMessageData
  ) => Promise<void>;
  editMessage: (
    messageData: MessageData,
    data: Partial<RESTPatchAPIChannelMessageJSONBody>
  ) => Promise<void>;

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

  interactionToComparableMessage: (
    interaction: GetConnectorType<'MessageComponentInteraction'>
  ) => ComparableMessage;

  getApplicationId: (client: GetConnectorType<'Client'>) => string;

  getModifiableWebhookFromInteraction: (
    interaction: GetConnectorType<'Interaction'>
  ) => ModifiableWebhook;
  getInteractionToken: (interaction: GetConnectorType<'Interaction'>) => string;

  replyToInteraction: (
    interaction:
      | GetConnectorType<'CommandInteraction'>
      | GetConnectorType<'MessageComponentInteraction'>,
    data: Partial<APIMessage>
  ) => Promise<{ messageId: string }>;

  sendToChannel: (
    channel_id: string,
    data: Partial<APIMessage>
  ) => Promise<MessageData>;

  /**
   * Either respond to the interaction with the update callback, or return false if the interaction has already been replied to
   * @param interaction the interaction to reply to
   * @param data the message data
   * @returns Whether or not the interaction was updated
   */
  tryUpdate: (
    interaction: GetConnectorType<'Interaction'>,
    data: Partial<SendablePage>
  ) => Promise<boolean>;
}
