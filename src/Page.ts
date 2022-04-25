import {
  BaseCommandInteraction,
  ButtonInteraction,
  CommandInteraction,
  InteractionWebhook,
  Message,
  MessageActionRow,
  MessageButton,
  MessageComponentInteraction,
  MessageEmbed,
  MessageOptions,
  MessagePayload,
  SelectMenuInteraction,
  TextBasedChannel,
  WebhookEditMessageOptions,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { PageActionRow, PageButton, PageSelect } from './PageComponents';
import { SlashasaurusClient } from './SlashasaurusClient';

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

export type PageButtonRow = PageButton[];
export type PageSelectRow = [PageSelect];

export type PageComponentArray = PageButtonRow | PageSelectRow;

type PageComponentRows = (PageComponentArray | PageActionRow)[];

export interface RenderedPage
  extends Omit<MessageOptions, 'nonce' | 'components'> {
  components?: PageComponentRows;
}

export function isPage(thing: any): thing is Page['constructor'] {
  if (!thing.prototype) return false;
  return thing.prototype instanceof Page;
}

export const DEFAULT_PAGE_ID = 'DEFAULT_PAGE_ID';

export class PageInteractionReplyMessage {
  constructor(public webhook: InteractionWebhook, public id: string) {}

  async edit(options: string | MessagePayload | WebhookEditMessageOptions) {
    await this.webhook.editMessage(this.id, options);
  }
}

export interface Page<P = {}, S = {}> {
  constructor(props: P): Page<P, S>;
  render(): RenderedPage | Promise<RenderedPage>;
}
export abstract class Page<P = {}, S = {}> {
  state: Readonly<S>;
  readonly props: Readonly<P>;
  readonly client: SlashasaurusClient;
  static _client: SlashasaurusClient;
  handlers: Map<string, Function>;
  nextId: number;
  message: Message | PageInteractionReplyMessage | null;
  static pageId: string = DEFAULT_PAGE_ID;
  latestInteraction: MessageComponentInteraction | null = null;

  constructor(props: P) {
    // @ts-expect-error this will say that _client doesn't exist on the constructor type, but it does and we're abusing that :^)
    if (!this.constructor._client)
      throw new Error(
        "This page hasn't been registered with your client, make sure that it's being registered correctly"
      );
    this.props = props;
    this.message = null;
    // @ts-expect-error this will say that _client doesn't exist on the constructor type, but it does and we're abusing that :^)
    this.client = this.constructor._client;
    this.handlers = new Map();
  }

  /**
   * Call this function to update the state of the Page, this will trigger a re-render and a message edit.
   *
   * **IMPORTANT**: This *can* fail if the bot is unable to edit the message due to no longer seeing the channel. It will throw and exception if this is the case.
   * @param nextState Either the changes you want to make to the state, or a funciton that takes the current state and returns the new state
   */
  async setState<K extends keyof S>(
    nextState:
      | ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null)
      | (Pick<S, K> | S | null)
  ): Promise<void> {
    if (!this.message)
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

  async transitionTo(newPage: Page) {
    newPage.message = this.message;
    newPage.latestInteraction = this.latestInteraction;
    await this.client.updatePage(newPage, newPage.state);
    return;
  }

  /**
   * This function serializes the current props and state of the page.
   * The string you return will be passed to `deserializeState()`
   * when loading this page if it left memory. This will be called
   * *every time the state changes* so that the state will be
   * preserved if the bot suddenly goes offline.
   */
  abstract serializeState(): string;

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

/**
 * This function will take a serialized state and set the props
 * and state of the page back to what they were when it was serialized.
 *
 * ***IMPORTANT***: this function *WILL* sometimes receive state from previous
 * versions of this page if you change the information returned by `serializeState()`
 * You *WILL* need to handle this or you will have improper state. If possible
 * you should attempt to convert the old version to the new version. If not, you
 * should delete this old page and prompt the user on how to re-open it.
 *
 * @param serializedState The string that was returned previously by `serializeState()`
 * @param interaction The interaction that triggered this page to wake up
 */
export type DeserializeStateFn<P = {}, S = {}> = (
  serializedState: string,
  interaction?: MessageComponentInteraction | CommandInteraction
) =>
  | {
      props: P;
      state: S;
    }
  | {};

export function pageComponentRowsToComponents(
  rows: PageComponentRows,
  page: Page
) {
  page.clearHandlers();
  // @ts-expect-error still messing with statics
  const pageId = page.constructor.pageId;
  return rows
    .map((row) => {
      const actionRow = new MessageActionRow();
      if (row instanceof PageActionRow) {
        row.children.forEach((component) => {
          actionRow.addComponents(
            componentToDjsComponent(component, page, pageId)
          );
        });
      } else if (Array.isArray(row)) {
        row.forEach((component) => {
          actionRow.addComponents(
            componentToDjsComponent(component, page, pageId)
          );
        });
      } else {
        return null;
      }
      return actionRow;
    })
    .filter<MessageActionRow>(
      (e): e is MessageActionRow => e instanceof MessageActionRow
    );
}

function componentToDjsComponent(
  component: PageComponentArray[number],
  page: Page,
  pageId: string
) {
  if ('handler' in component) {
    return component.toDjsComponent(
      `~${pageId};${page.registerHandler(component.handler)}`
    );
  } else {
    return new MessageButton({
      ...component,
      style: MessageButtonStyles.LINK,
      type: 'BUTTON',
    });
  }
}

export function compareMessages(
  a: MessageComponentInteraction['message'],
  b: RenderedPage
) {
  if (a.content !== (b.content ?? '')) return false;

  const bComponents = b.components?.filter(
    (c) => Array.isArray(c) || c instanceof PageActionRow
  );

  // Check Components
  if (
    a.components &&
    bComponents &&
    a.components.length === bComponents.length
  ) {
    // They both have components, lets compare them
    const componentsMatch = [...a.components].every((row, index) => {
      const bRow = bComponents![index];
      const bChildren = bRow instanceof PageActionRow ? bRow.children : bRow;
      if (row.components.length !== bChildren.length) return false;
      return [...bChildren].every((component, index) => {
        return component.compareToComponent(row.components[index]);
      });
    });
    if (!componentsMatch) return false;
  } else if (a.components || bComponents) {
    // One has components but the other doesn't
    return false;
  }

  // Check Embeds
  if (
    // @ts-expect-error
    a.embeds.filter((e) => e.type === 'rich').length !== (b.embeds ?? []).length
  )
    return false;
  if (a.embeds.length > 0) {
    if (
      !b.embeds!.every((bEmbedData, index) => {
        const bEmbed =
          bEmbedData instanceof MessageEmbed
            ? bEmbedData
            : new MessageEmbed(bEmbedData);
        // return bEmbed.equals(a.embeds[index]);
        return embedsAreEqual(a.embeds[index], bEmbed);
      })
    ) {
      return false;
    }
  }

  return true;
}

function embedsAreEqual(
  a: MessageComponentInteraction['message']['embeds'][number],
  b: MessageEmbed
) {
  if (a.type !== 'rich') return true;

  if (
    a.title !== (b.title ? b.title.trim() : b.title) ||
    a.type !== b.type ||
    a.description !== (b.description ? b.description.trim() : b.description) ||
    a.url !== b.url ||
    (a.color ?? 0) !== b.color
  )
    return false;

  // Compare timestamps
  if (a.timestamp && b.timestamp) {
    if (new Date(a.timestamp).getTime() !== new Date(b.timestamp).getTime())
      return false;
  } else if (a.timestamp || b.timestamp) return false;

  // Compare authors
  const headerIconUrl =
    a.author &&
    ('iconURL' in a.author
      ? a.author.iconURL
      : 'icon_url' in a.author
      ? a.author.icon_url
      : undefined);
  if (
    a.author &&
    b.author &&
    (a.author.name !== b.author.name?.trim() ||
      headerIconUrl !== b.author.iconURL ||
      a.author.url !== b.author.url)
  )
    return false;
  else if ((a.author && !b.author) || (b.author && !a.author)) return false;

  // Compare footers
  const footerIconUrl =
    a.footer &&
    ('iconURL' in a.footer
      ? a.footer.iconURL
      : 'icon_url' in a.footer
      ? a.footer.icon_url
      : undefined);
  if (
    a.footer &&
    b.footer &&
    (a.footer?.text !== b.footer?.text?.trim() ||
      footerIconUrl !== b.footer?.iconURL)
  )
    return false;
  else if ((a.footer && !b.footer) || (b.footer && !a.footer)) return false;

  // Compare images
  if (
    (a.image && !b.image) ||
    (b.image && !a.image) ||
    a.image?.url !== b.image?.url
  )
    return false;
  if (
    (a.thumbnail && !b.thumbnail) ||
    (b.thumbnail && !a.thumbnail) ||
    a.thumbnail?.url !== b.thumbnail?.url
  )
    return false;

  // Compare fields
  if ((a.fields ?? []).length !== b.fields.length) return false;
  return (a.fields ?? []).every(
    (f, i) =>
      f.inline === b.fields[i].inline &&
      f.name === b.fields[i].name?.trim() &&
      f.value === b.fields[i].value?.trim()
  );
}
