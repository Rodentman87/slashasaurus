import {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  ContextMenuCommandInteraction,
  Message,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  SelectMenuInteraction,
} from 'discord.js';
import { ConnectorTypes } from './SlashasaurusClient';

export interface DJSConnectorTypes extends ConnectorTypes {
  AutocompleteInteraction: AutocompleteInteraction;
  ButtonInteraction: ButtonInteraction;
  ChatInputCommandInteraction: ChatInputCommandInteraction;
  Client: Client;
  CommandInteraction: CommandInteraction;
  ContextMenuCommandInteraction: ContextMenuCommandInteraction;
  MessageComponentInteraction: MessageComponentInteraction;
  ModalSubmitInteraction: ModalSubmitInteraction;
  SelectMenuInteraction: SelectMenuInteraction;
  Message: Message;
}
