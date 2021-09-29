import {
  ChatInputApplicationCommandData,
  CommandInteraction,
} from 'discord.js';
import { InteractionsClient } from './InteractionsClient';

export abstract class SlashCommandBase {
  abstract commandInfo: ChatInputApplicationCommandData;
  abstract run(
    interaction: CommandInteraction,
    client: InteractionsClient
  ): void;
}
