import { SelectMenuBuilder } from '@discordjs/builders';
import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentEmojiResolvable,
  ComponentType,
  MessageComponentInteraction,
  SelectMenuInteraction,
  parseEmoji,
  SelectMenuOptionBuilder,
  UserSelectMenuBuilder,
  UserSelectMenuComponentData,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  RoleSelectMenuBuilder,
  RoleSelectMenuComponentData,
  UserSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ChannelSelectMenuComponentData,
  ChannelSelectMenuInteraction,
  MentionableSelectMenuComponentData,
  MentionableSelectMenuInteraction,
  ChannelType,
  APISelectMenuOption,
} from 'discord.js';

type NonLinkStyles =
  | ButtonStyle.Danger
  | ButtonStyle.Secondary
  | ButtonStyle.Primary
  | ButtonStyle.Success;

type PageButtonLabelOptions =
  | {
      label: string;
      emoji?: ComponentEmojiResolvable;
    }
  | {
      label?: string;
      emoji: ComponentEmojiResolvable;
    };

type PotentialDjsComponent = NonNullable<
  MessageComponentInteraction['message']['components']
>[number]['components'][number];

interface ExportableToDjsComponent {
  toDjsComponent(
    id: string
  ):
    | ButtonBuilder
    | SelectMenuBuilder
    | UserSelectMenuBuilder
    | RoleSelectMenuBuilder
    | ChannelSelectMenuBuilder
    | MentionableSelectMenuBuilder;
}

export function createInteractable<P>(
  component: new (props: P) => unknown | ((props: P) => unknown) | null,
  props: P,
  ...children: unknown[]
) {
  if (!component) return children;
  try {
    return new component({
      ...props,
      children: children.length > 1 ? children : children[0],
    });
  } catch (e) {
    // @ts-expect-error this should work fine, this is like the only way to check that the component is a function
    return component({
      ...props,
      children: children.length > 1 ? children : children[0],
    });
  }
}

type PageActionRowChild = PageButton | PageSelect;

interface PageActionRowProps {
  children?: (PageActionRowChild | false) | (PageActionRowChild | false)[];
}

export class PageActionRow {
  children: PageActionRowChild[];

  constructor({ children }: PageActionRowProps) {
    if (Array.isArray(children))
      this.children = children
        .flat()
        .filter(
          (c): c is PageActionRowChild =>
            c instanceof PageInteractableButton ||
            c instanceof PageLinkButton ||
            c instanceof PageSelect
        );
    else if (children) this.children = [children];
  }
}

export type PageInteractableButtonOptions = {
  handler: (interaction: ButtonInteraction) => void;
  style?: NonLinkStyles;
  disabled?: boolean;
} & PageButtonLabelOptions;

export type PageLinkButtonOptions = {
  url: string;
  disabled?: boolean;
} & PageButtonLabelOptions;

export class PageInteractableButton implements ExportableToDjsComponent {
  type: ComponentType.Button = ComponentType.Button;
  handler: (interaction: ButtonInteraction) => void;
  style: NonLinkStyles = ButtonStyle.Secondary;
  disabled = false;
  label?: string;
  emoji?: ComponentEmojiResolvable;

  constructor(options: PageInteractableButtonOptions) {
    this.handler = options.handler;
    if (options.style) this.style = options.style;
    if (options.disabled) this.disabled = options.disabled;
    if (options.label) this.label = options.label;
    if (options.emoji) this.emoji = options.emoji;
  }

  toDjsComponent(id: string): ButtonBuilder {
    const builder = new ButtonBuilder({
      style: this.style,
      disabled: this.disabled,
      customId: id,
    });
    if (this.label) builder.setLabel(this.label);
    if (this.emoji) builder.setEmoji(this.emoji);
    return builder;
  }

  compareToComponent(component: PotentialDjsComponent) {
    if (!(component.type === ComponentType.Button)) return false;
    if ((this.emoji && !component.emoji) || (!this.emoji && component.emoji))
      return false;
    if (this.emoji && component.emoji) {
      if (!compareEmoji(this.emoji, component.emoji)) return false;
    }
    return (
      this.style === component.style &&
      this.disabled === (component.disabled ?? false) &&
      (this.label ?? null) === component.label
    );
  }
}

export class PageLinkButton implements ExportableToDjsComponent {
  type: ComponentType.Button = ComponentType.Button;
  url: string;
  disabled = false;
  label?: string;
  emoji?: ComponentEmojiResolvable;

  constructor(options: PageLinkButtonOptions) {
    this.url = options.url;
    if (options.disabled) this.disabled = options.disabled;
    if (options.label) this.label = options.label;
    if (options.emoji) this.emoji = options.emoji;
  }

  toDjsComponent(): ButtonBuilder {
    const builder = new ButtonBuilder({
      style: ButtonStyle.Link,
      disabled: this.disabled,
      url: this.url,
    });
    if (this.label) builder.setLabel(this.label);
    if (this.emoji) builder.setEmoji(this.emoji);
    return builder;
  }

  compareToComponent(component: PotentialDjsComponent) {
    if (!(component.type === ComponentType.Button)) return false;
    if ((this.emoji && !component.emoji) || (!this.emoji && component.emoji))
      return false;
    if (this.emoji && component.emoji) {
      if (!compareEmoji(this.emoji, component.emoji)) return false;
    }
    return (
      ButtonStyle.Link === component.style &&
      this.disabled === component.disabled &&
      (this.label ?? null) === component.label &&
      this.url === component.url
    );
  }
}

export type PageButton = PageInteractableButton | PageLinkButton;

export interface PageSelectOptions {
  handler: (interaction: SelectMenuInteraction) => void;
  options: APISelectMenuOption[] | SelectMenuOptionBuilder[];
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

/**
 * @deprecated Use PageStringSelect instead
 */
export class PageSelect implements ExportableToDjsComponent {
  type: ComponentType.StringSelect = ComponentType.StringSelect;
  handler: (interaction: SelectMenuInteraction) => void;
  options: SelectMenuOptionBuilder[] = [];
  placeholder?: string;
  minValues = 1;
  maxValues = 1;
  disabled = false;

  constructor(options: PageSelectOptions) {
    this.handler = options.handler;
    // Convert the options to SelectMenuOptionBuilders so that we don't have to deal with emoji weirdness
    for (const option of options.options) {
      if (option instanceof SelectMenuOptionBuilder) {
        this.options.push(option);
      } else {
        this.options.push(new SelectMenuOptionBuilder(option));
      }
    }
    if (options.placeholder) this.placeholder = options.placeholder;
    if (options.minValues) this.minValues = options.minValues;
    if (options.maxValues) this.maxValues = options.maxValues;
    if (options.disabled) this.disabled = options.disabled;
  }

  toDjsComponent(id: string) {
    const builder = new SelectMenuBuilder({
      min_values: this.minValues,
      max_values: this.maxValues,
      disabled: this.disabled,
      custom_id: id,
    });
    builder.addOptions(this.options);
    if (this.placeholder) builder.setPlaceholder(this.placeholder);
    return builder;
  }

  compareToComponent(component: PotentialDjsComponent) {
    if (!(component.type === ComponentType.StringSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.maxValues ||
      this.minValues !== component.minValues ||
      this.placeholder !== component.placeholder
    )
      return false;
    if (this.options.length !== component.options.length) return false;
    return this.options.every((option, index) => {
      const other = component.options[index];

      if (
        other.default !== (option.data.default ?? false) ||
        other.description !== (option.data.description ?? null) ||
        other.label !== option.data.label ||
        other.value !== option.data.value
      )
        return false;
      if (
        (option.data.emoji && !other.emoji) ||
        (!option.data.emoji && other.emoji)
      )
        return false;
      if (option.data.emoji && other.emoji) {
        if (!compareEmoji(option.data.emoji, other.emoji)) return false;
      }
      return true;
    });
  }
}

export class PageStringSelect extends PageSelect {}

export interface PageUserSelectOptions {
  handler: (interaction: UserSelectMenuInteraction) => void;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export class PageUserSelect implements ExportableToDjsComponent {
  type: ComponentType.UserSelect = ComponentType.UserSelect;
  handler: (interaction: UserSelectMenuInteraction) => void;
  placeholder?: string;
  minValues = 1;
  maxValues = 1;
  disabled = false;

  constructor(options: PageUserSelectOptions) {
    this.handler = options.handler;
    if (options.placeholder) this.placeholder = options.placeholder;
    if (options.minValues) this.minValues = options.minValues;
    if (options.maxValues) this.maxValues = options.maxValues;
    if (options.disabled) this.disabled = options.disabled;
  }

  toDjsComponent(id: string) {
    const options: UserSelectMenuComponentData = {
      type: ComponentType.UserSelect,
      minValues: this.minValues,
      maxValues: this.maxValues,
      disabled: this.disabled,
      customId: id,
    };
    if (this.placeholder) options.placeholder = this.placeholder;
    const builder = new UserSelectMenuBuilder(options);
    return builder;
  }

  compareToComponent(component: PotentialDjsComponent) {
    if (!(component.type === ComponentType.UserSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.maxValues ||
      this.minValues !== component.minValues ||
      this.placeholder !== component.placeholder
    )
      return false;
    return true;
  }
}

export interface PageRoleSelectOptions {
  handler: (interaction: RoleSelectMenuInteraction) => void;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export class PageRoleSelect implements ExportableToDjsComponent {
  type: ComponentType.RoleSelect = ComponentType.RoleSelect;
  handler: (interaction: RoleSelectMenuInteraction) => void;
  placeholder?: string;
  minValues = 1;
  maxValues = 1;
  disabled = false;

  constructor(options: PageRoleSelectOptions) {
    this.handler = options.handler;
    if (options.placeholder) this.placeholder = options.placeholder;
    if (options.minValues) this.minValues = options.minValues;
    if (options.maxValues) this.maxValues = options.maxValues;
    if (options.disabled) this.disabled = options.disabled;
  }

  toDjsComponent(id: string) {
    const options: RoleSelectMenuComponentData = {
      type: ComponentType.RoleSelect,
      minValues: this.minValues,
      maxValues: this.maxValues,
      disabled: this.disabled,
      customId: id,
    };
    if (this.placeholder) options.placeholder = this.placeholder;
    const builder = new RoleSelectMenuBuilder(options);
    return builder;
  }

  compareToComponent(component: PotentialDjsComponent) {
    if (!(component.type === ComponentType.StringSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.maxValues ||
      this.minValues !== component.minValues ||
      this.placeholder !== component.placeholder
    )
      return false;
    return true;
  }
}

export interface PageChannelSelectOptions {
  handler: (interaction: ChannelSelectMenuInteraction) => void;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
  channelTypes?: ChannelType[];
}

export class PageChannelSelect implements ExportableToDjsComponent {
  type: ComponentType.ChannelSelect = ComponentType.ChannelSelect;
  handler: (interaction: ChannelSelectMenuInteraction) => void;
  placeholder?: string;
  minValues = 1;
  maxValues = 1;
  disabled = false;
  channelTypes?: ChannelType[];

  constructor(options: PageChannelSelectOptions) {
    this.handler = options.handler;
    if (options.placeholder) this.placeholder = options.placeholder;
    if (options.minValues) this.minValues = options.minValues;
    if (options.maxValues) this.maxValues = options.maxValues;
    if (options.disabled) this.disabled = options.disabled;
    if (options.channelTypes) this.channelTypes = options.channelTypes;
  }

  toDjsComponent(id: string) {
    const options: ChannelSelectMenuComponentData = {
      type: ComponentType.ChannelSelect,
      minValues: this.minValues,
      maxValues: this.maxValues,
      disabled: this.disabled,
      customId: id,
    };
    if (this.channelTypes) options.channelTypes = this.channelTypes;
    if (this.placeholder) options.placeholder = this.placeholder;
    const builder = new ChannelSelectMenuBuilder(options);
    return builder;
  }

  compareToComponent(component: PotentialDjsComponent) {
    if (!(component.type === ComponentType.ChannelSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.maxValues ||
      this.minValues !== component.minValues ||
      this.placeholder !== component.placeholder
    )
      return false;
    return true;
  }
}

export interface PageMentionableSelectOptions {
  handler: (interaction: MentionableSelectMenuInteraction) => void;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export class PageMentionableSelect implements ExportableToDjsComponent {
  type: ComponentType.MentionableSelect = ComponentType.MentionableSelect;
  handler: (interaction: MentionableSelectMenuInteraction) => void;
  placeholder?: string;
  minValues = 1;
  maxValues = 1;
  disabled = false;

  constructor(options: PageMentionableSelectOptions) {
    this.handler = options.handler;
    if (options.placeholder) this.placeholder = options.placeholder;
    if (options.minValues) this.minValues = options.minValues;
    if (options.maxValues) this.maxValues = options.maxValues;
    if (options.disabled) this.disabled = options.disabled;
  }

  toDjsComponent(id: string) {
    const options: MentionableSelectMenuComponentData = {
      type: ComponentType.MentionableSelect,
      minValues: this.minValues,
      maxValues: this.maxValues,
      disabled: this.disabled,
      customId: id,
    };
    if (this.placeholder) options.placeholder = this.placeholder;
    const builder = new MentionableSelectMenuBuilder(options);
    return builder;
  }

  compareToComponent(component: PotentialDjsComponent) {
    if (!(component.type === ComponentType.MentionableSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.maxValues ||
      this.minValues !== component.minValues ||
      this.placeholder !== component.placeholder
    )
      return false;
    return true;
  }
}

function compareEmoji(
  a: ComponentEmojiResolvable,
  bEmoji: { id?: string | null; name?: string | null }
) {
  const aEmoji = typeof a === 'string' ? parseEmoji(a) : a;
  if (!aEmoji) return false;
  if (aEmoji.id) {
    return aEmoji.id === bEmoji.id;
  } else {
    return aEmoji.name === bEmoji.name;
  }
}
