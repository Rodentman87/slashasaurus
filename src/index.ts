import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteraction,
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
  APIUserApplicationCommandInteraction,
} from 'discord-api-types/v10';

declare global {
  interface ConnectorTypes {
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
    InteractionWebhook: unknown;
    Interaction: APIInteraction;
  }
}

export * from './ContextMenuBase';
export * from './CustomErrors';
export { Middleware } from './MiddlewarePipeline';
export * from './OptionTypes';
export * from './Page';
export * from './PageComponents';
export * from './SlashasaurusClient';
export * from './SlashCommandBase';
export { TemplateModal } from './TemplateModal';
export * from './utilityTypes';
