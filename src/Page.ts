import {
  BaseCommandInteraction,
  ButtonInteraction,
  EmojiIdentifierResolvable,
  ExcludeEnum,
  Guild,
  GuildMember,
  MessageActionRow,
  MessageButton,
  MessageComponentInteraction,
  MessageOptions,
  MessageSelectMenu,
  MessageSelectOptionData,
  SelectMenuInteraction,
  TextBasedChannel,
  User,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { InteractionsClient } from './InteractionsClient';

interface SerializedObject {
  type: string;
  identifier: SerializableValue;
}

type SerializableValue =
  | null
  | string
  | number
  | SerializedObject
  | Array<SerializableValue>;

type NonLinkStyles = ExcludeEnum<typeof MessageButtonStyles, 'LINK'>;

type PageButtonLabelOptions =
  | {
      label: string;
      emoji?: EmojiIdentifierResolvable;
    }
  | {
      label?: string;
      emoji: EmojiIdentifierResolvable;
    };

export type PageInteractableButton = {
  type: 'button';
  handler: (interaction: ButtonInteraction) => void;
  style?: NonLinkStyles;
  disabled?: boolean;
} & PageButtonLabelOptions;

export type PageLinkButton = {
  type: 'button';
  url: string;
  disabled?: boolean;
} & PageButtonLabelOptions;

export type PageButton = PageInteractableButton | PageLinkButton;

export interface PageSelect {
  type: 'select';
  handler: (interaction: SelectMenuInteraction) => void;
  options: MessageSelectOptionData[];
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export type PageButtonRow = PageButton[];

export type PageComponentRow = PageButtonRow | PageSelect;

type PageComponentRows = PageComponentRow[];

export interface RenderedPage
  extends Omit<MessageOptions, 'nonce' | 'components'> {
  components?: PageComponentRows;
}

export interface Page<C = InteractionsClient, P = {}, S = {}> {
  constructor(props: P, client: C): Page<C, P, S>;
  render(): RenderedPage;
}
export abstract class Page<
  C extends InteractionsClient = InteractionsClient,
  P = {},
  S = {}
> {
  state: Readonly<S>;
  readonly props: Readonly<P>;
  readonly client: C;
  handlers: Map<string, Function>;
  nextId: number;
  messsageId: string | null;
  pageId: string;

  constructor(pageId: string, props: P, client: C) {
    this.props = props;
    this.messsageId = null;
    this.pageId = pageId;
    this.client = client;
    this.handlers = new Map();
  }

  async setState<K extends keyof S>(
    nextState:
      | ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null)
      | (Pick<S, K> | S | null)
  ): Promise<void> {
    if (!this.messsageId)
      throw new Error('You cannot update the state of a Page before it sends');
    if (nextState instanceof Function) {
      // Run the function to get the new state values
      nextState = nextState(this.state, this.props);
    }
    let newState = {
      ...this.state,
    };
    Object.assign(newState, nextState);
    await this.client.updatePage(this, newState);
    return;
  }

  sendToChannel(channel: TextBasedChannel) {
    this.client.sendPageToChannel(this, channel);
  }

  sendAsReply(
    interaction: MessageComponentInteraction | BaseCommandInteraction,
    ephemeral = false
  ) {
    this.client.replyToInteractionWithPage(this, interaction, ephemeral);
  }

  /**
   * This function serializes the current state of the page.
   * This is used specifically when a page needs to leave
   * memory in order to clear
   */
  serializeState() {
    let serializedState: Record<string, SerializableValue> = {};
    for (const key in this.state) {
      serializedState[key] = serializeValue(this.state[key]);
    }
  }

  handleId(id: string, interaction: ButtonInteraction | SelectMenuInteraction) {
    let handler = this.handlers.get(id);
    if (handler) {
      handler(interaction);
    } else {
      throw new Error('Handler not registered for this component');
    }
  }

  clearHandlers() {
    this.handlers.clear();
    this.nextId = 0;
  }

  registerHandler(handler: Function) {
    const id = this.nextId;
    this.nextId++;
    this.handlers.set(id.toString(), handler);
    return id;
  }
}

export function serializeValue(value: any): SerializableValue {
  if (Array.isArray(value)) {
    return value.map((val) => serializeValue(val));
  } else if (value instanceof User) {
    return {
      type: 'user',
      identifier: value.id,
    };
  } else if (value instanceof GuildMember) {
    return {
      type: 'member',
      identifier: [value.id, value.guild.id],
    };
  } else if (value instanceof Guild) {
    return {
      type: 'guild',
      identifier: value.id,
    };
  } else {
    return value;
  }
}

export function pageComponentRowsToComponents(
  rows: PageComponentRows,
  page: Page
) {
  page.clearHandlers();
  return rows.map((row) => {
    const actionRow = new MessageActionRow();
    if (Array.isArray(row)) {
      // This is a set of buttons
      row.forEach((button) => {
        if ('handler' in button) {
          actionRow.addComponents(
            new MessageButton({
              ...button,
              style: button.style ?? MessageButtonStyles.SECONDARY,
              customId: `~${page.pageId};${page.registerHandler(
                button.handler
              )}`,
              type: 'BUTTON',
            })
          );
        } else {
          actionRow.addComponents(
            new MessageButton({
              ...button,
              style: MessageButtonStyles.LINK,
              type: 'BUTTON',
            })
          );
        }
      });
    } else {
      actionRow.addComponents(
        new MessageSelectMenu({
          ...row,
          customId: `~${page.pageId};${page.registerHandler(row.handler)}`,
          type: 'SELECT_MENU',
        })
      );
    }
    return actionRow;
  });
}
