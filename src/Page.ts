import {
  APIActionRowComponent,
  APIEmbed,
  APIMessageActionRowComponent,
  ComponentType,
  RESTPostAPIChannelMessageJSONBody,
} from 'discord-api-types/v10';
// import {
//   ActionRowBuilder,
//   APIEmbed,
//   MessageActionRowComponentBuilder,
//   MessageCreateOptions,
//   MessagePayload,
// } from 'discord.js';
import {
  ComparableComponent,
  PageActionRow,
  PageButton,
  PageSelect,
} from './PageComponents';
import {
  InteractionMessageData,
  MessageData,
  SlashasaurusClient,
} from './SlashasaurusClient';
import {
  GetConnectorType,
  MaybePromise,
  ModifiableWebhook,
} from './utilityTypes';

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
  extends Omit<
    RESTPostAPIChannelMessageJSONBody,
    | 'nonce'
    | 'components'
    | 'content'
    | 'embeds'
    | 'attachments'
    | 'message_reference'
    | 'tts'
  > {
  content?: string | null;
  components?: PageComponentRows;
  embeds?: APIEmbed[];
}

export interface SendablePage {
  content?: string | null;
  components?: APIActionRowComponent<APIMessageActionRowComponent>[];
  embeds?: APIEmbed[];
  flags?: number;
  allowed_mentions?: RESTPostAPIChannelMessageJSONBody['allowed_mentions'];
  sticker_ids?: RESTPostAPIChannelMessageJSONBody['sticker_ids'];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPage(thing: any): thing is Page['constructor'] {
  if (!thing.prototype) return false;
  return thing.prototype instanceof Page;
}

export const DEFAULT_PAGE_ID = 'DEFAULT_PAGE_ID';

export class PageInteractionReplyMessage {
  constructor(
    public webhook: ModifiableWebhook,
    public webhookToken: string,
    public messageId: string
  ) {}

  async edit(options: SendablePage) {
    await this.webhook.editMessage(this.messageId, options);
  }

  async delete() {
    await this.webhook.deleteMessage(this.messageId);
  }

  serialize(): InteractionMessageData {
    return {
      messageId: this.messageId,
      webhookToken: this.webhookToken,
    };
  }
}

interface PageStatic<P, S> {
  new (): Page<P, S>;
  pageId: string;
  _client: SlashasaurusClient;
  deserializeState: DeserializeStateFn<P, S>;
}

export interface Page<P = Record<string, never>, S = Record<string, never>> {
  constructor: PageStatic<P, S>;
  render(): RenderedPage | Promise<RenderedPage>;
  pageDidSend?(): void | Promise<void>;
  pageWillLeaveCache?(): void | Promise<void>;
}
export abstract class Page<
  P = Record<string, never>,
  S = Record<string, never>
> {
  state: Readonly<S>;
  readonly props: Readonly<P>;
  readonly client: SlashasaurusClient;
  // eslint-disable-next-line @typescript-eslint/ban-types
  handlers: Map<string, Function>;
  nextId: number;
  message: MessageData | PageInteractionReplyMessage | null;
  static pageId = DEFAULT_PAGE_ID;
  latestInteraction: GetConnectorType<'MessageComponentInteraction'> | null =
    null;

  constructor(props: P) {
    if (!this.constructor._client)
      throw new Error(
        "This page hasn't been registered with your client, make sure that it's being registered correctly"
      );
    this.props = props;
    this.message = null;
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
    const newState = {
      ...this.state,
    };
    Object.assign(newState, nextState);
    await this.client.updatePage(this, newState);
    return;
  }

  async sendToChannel(channel_id: string) {
    return this.client.sendPageToChannel(this, channel_id);
  }

  // sendAsForumPost(channel: ForumChannel, postTitle: string) {
  //   return this.client.sendPageToForumChannel(this, postTitle, channel);
  // }

  sendAsReply(
    interaction:
      | GetConnectorType<'MessageComponentInteraction'>
      | GetConnectorType<'CommandInteraction'>,
    ephemeral = false
  ) {
    return this.client.replyToInteractionWithPage(this, interaction, ephemeral);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async transitionTo(newPage: Page<any, any>) {
    newPage.message = this.message;
    newPage.latestInteraction = this.latestInteraction;
    // await this.client.updatePage(newPage, newPage.state);
    newPage.pageDidSend?.();
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

  async handleId(
    id: string,
    interaction:
      | GetConnectorType<'ButtonInteraction'>
      | GetConnectorType<'SelectMenuInteraction'>
      | GetConnectorType<'UserSelectMenuInteraction'>
      | GetConnectorType<'RoleSelectMenuInteraction'>
      | GetConnectorType<'ChannelSelectMenuInteraction'>
      | GetConnectorType<'MentionableSelectMenuInteraction'>
  ) {
    const handler = this.handlers.get(id);
    if (handler) {
      await handler(interaction);
    } else {
      throw new Error('Handler not registered for this component');
    }
  }

  clearHandlers() {
    this.handlers.clear();
    this.nextId = 0;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
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
export type DeserializeStateFn<
  P = Record<string, never>,
  S = Record<string, never>
> = (
  serializedState: string,
  interaction?:
    | GetConnectorType<'MessageComponentInteraction'>
    | GetConnectorType<'CommandInteraction'>
    | GetConnectorType<'ModalSubmitInteraction'>
) => MaybePromise<
  | {
      props: P;
      state: S;
    }
  | Record<string, never>
>;

export function pageComponentRowsToComponents<P, S>(
  rows: PageComponentRows,
  page: Page<P, S>
): APIActionRowComponent<APIMessageActionRowComponent>[] {
  page.clearHandlers();
  const pageId = page.constructor.pageId;
  return rows
    .map((row) => {
      const actionRow: APIActionRowComponent<APIMessageActionRowComponent> = {
        type: ComponentType.ActionRow,
        components: [],
      };
      if (row instanceof PageActionRow) {
        row.children.forEach((component) => {
          actionRow.components.push(
            componentToDjsComponent(component, page, pageId)
          );
        });
      } else if (Array.isArray(row)) {
        row.forEach((component) => {
          actionRow.components.push(
            componentToDjsComponent(component, page, pageId)
          );
        });
      } else {
        return null;
      }
      return actionRow;
    })
    .filter<APIActionRowComponent<APIMessageActionRowComponent>>(
      (e): e is APIActionRowComponent<APIMessageActionRowComponent> =>
        e !== null
    );
}

function componentToDjsComponent<P, S>(
  component: PageComponentArray[number],
  page: Page<P, S>,
  pageId: string
): APIMessageActionRowComponent {
  if ('handler' in component) {
    return component
      .toApiComponent(`~${pageId};${page.registerHandler(component.handler)}`)
      .toJSON();
  } else {
    return component.toApiComponent().toJSON();
  }
}

interface ComparableActionRow {
  components: ComparableComponent[];
}

export interface ComparableMessage {
  content?: string;
  components?: ComparableActionRow[];
  embeds: APIEmbed[];
}

export function compareMessages(a: ComparableMessage, b: RenderedPage) {
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
      const bRow = bComponents[index];
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
    a.embeds.filter((e) => e.type === 'rich').length !== (b.embeds ?? []).length
  )
    return false;
  if (a.embeds.length > 0) {
    if (
      !(b.embeds ?? []).every((bEmbed, index) => {
        return embedsAreEqual(a.embeds[index], bEmbed);
      })
    ) {
      return false;
    }
  }

  return true;
}

function embedsAreEqual(a: APIEmbed, b: APIEmbed) {
  if (
    a.title !== (b.title ? b.title.trim() : b.title) ||
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
    a.author && ('iconURL' in a.author ? a.author.iconURL : undefined);
  if (
    a.author &&
    b.author &&
    (a.author.name !== b.author.name?.trim() ||
      headerIconUrl !== b.author.icon_url ||
      a.author.url !== b.author.url)
  )
    return false;
  else if ((a.author && !b.author) || (b.author && !a.author)) return false;

  // Compare footers
  const footerIconUrl =
    a.footer && ('iconURL' in a.footer ? a.footer.iconURL : undefined);
  if (
    a.footer &&
    b.footer &&
    (a.footer?.text !== b.footer?.text?.trim() ||
      footerIconUrl !== b.footer?.icon_url)
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
  const aFields = a.fields ?? [];
  const bFields = b.fields ?? [];
  if (aFields.length !== bFields.length) return false;
  return aFields.every(
    (f, i) =>
      (f.inline ?? false) === (bFields[i].inline ?? false) &&
      f.name === bFields[i].name?.trim() &&
      f.value === bFields[i].value?.trim()
  );
}
