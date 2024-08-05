import {
  ButtonBuilder,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  RoleSelectMenuBuilder,
  SelectMenuBuilder,
  UserSelectMenuBuilder,
} from '@discordjs/builders';
import {
  APIChannelSelectComponent,
  APIMentionableSelectComponent,
  APIMessageComponentEmoji,
  APIRoleSelectComponent,
  APISelectMenuOption,
  APIUserSelectComponent,
  ButtonStyle,
  ChannelType,
  ComponentType,
} from 'discord-api-types/v10';
import { GetConnectorType } from './utilityTypes';

type NonLinkStyles =
  | ButtonStyle.Danger
  | ButtonStyle.Secondary
  | ButtonStyle.Primary
  | ButtonStyle.Success;

type PageButtonLabelOptions =
  | {
      label: string;
      emoji?: APIMessageComponentEmoji;
    }
  | {
      label?: string;
      emoji: APIMessageComponentEmoji;
    };

interface ComparableButton {
  type: ComponentType.Button;
  style: ButtonStyle;
  disabled: boolean;
  label?: string;
  emoji?: APIMessageComponentEmoji;
  url?: string;
}

interface ComparableStringSelect {
  type: ComponentType.StringSelect;
  disabled: boolean;
  max_values: number;
  min_values: number;
  placeholder?: string;
  options: APISelectMenuOption[];
}

interface ComparableAutoFilledSelect {
  type:
    | ComponentType.UserSelect
    | ComponentType.RoleSelect
    | ComponentType.ChannelSelect
    | ComponentType.MentionableSelect;
  disabled: boolean;
  max_values: number;
  min_values: number;
  placeholder?: string;
  channel_types?: ChannelType[];
}

export type ComparableComponent =
  | ComparableButton
  | ComparableStringSelect
  | ComparableAutoFilledSelect;

interface ExportableToDjsComponent {
  toApiComponent(
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
  handler: (interaction: GetConnectorType<'ButtonInteraction'>) => void;
  style?: NonLinkStyles;
  disabled?: boolean;
} & PageButtonLabelOptions;

export type PageLinkButtonOptions = {
  url: string;
  disabled?: boolean;
} & PageButtonLabelOptions;

export class PageInteractableButton implements ExportableToDjsComponent {
  type: ComponentType.Button = ComponentType.Button;
  handler: (interaction: GetConnectorType<'ButtonInteraction'>) => void;
  style: NonLinkStyles = ButtonStyle.Secondary;
  disabled = false;
  label?: string;
  emoji?: APIMessageComponentEmoji;

  constructor(options: PageInteractableButtonOptions) {
    this.handler = options.handler;
    if (options.style) this.style = options.style;
    if (options.disabled) this.disabled = options.disabled;
    if (options.label) this.label = options.label;
    if (options.emoji) this.emoji = options.emoji;
  }

  toApiComponent(id: string): ButtonBuilder {
    const builder = new ButtonBuilder({
      style: this.style,
      disabled: this.disabled,
      custom_id: id,
    });
    if (this.label) builder.setLabel(this.label);
    if (this.emoji) builder.setEmoji(this.emoji);
    return builder;
  }

  compareToComponent(component: ComparableComponent) {
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
  emoji?: APIMessageComponentEmoji;

  constructor(options: PageLinkButtonOptions) {
    this.url = options.url;
    if (options.disabled) this.disabled = options.disabled;
    if (options.label) this.label = options.label;
    if (options.emoji) this.emoji = options.emoji;
  }

  toApiComponent(): ButtonBuilder {
    const builder = new ButtonBuilder({
      style: ButtonStyle.Link,
      disabled: this.disabled,
      url: this.url,
    });
    if (this.label) builder.setLabel(this.label);
    if (this.emoji) builder.setEmoji(this.emoji);
    return builder;
  }

  compareToComponent(component: ComparableComponent) {
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
  handler: (interaction: GetConnectorType<'SelectMenuInteraction'>) => void;
  options: APISelectMenuOption[];
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
  handler: (interaction: GetConnectorType<'SelectMenuInteraction'>) => void;
  options: APISelectMenuOption[] = [];
  placeholder?: string;
  minValues = 1;
  maxValues = 1;
  disabled = false;

  constructor(options: PageSelectOptions) {
    this.handler = options.handler;
    // Convert the options to SelectMenuOptionBuilders so that we don't have to deal with emoji weirdness
    this.options = options.options;
    if (options.placeholder) this.placeholder = options.placeholder;
    if (options.minValues) this.minValues = options.minValues;
    if (options.maxValues) this.maxValues = options.maxValues;
    if (options.disabled) this.disabled = options.disabled;
  }

  toApiComponent(id: string) {
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

  compareToComponent(component: ComparableComponent) {
    if (!(component.type === ComponentType.StringSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.max_values ||
      this.minValues !== component.min_values ||
      this.placeholder !== component.placeholder
    )
      return false;
    if (this.options.length !== component.options.length) return false;
    return this.options.every((option, index) => {
      const other = component.options[index];

      if (
        other.default !== (option.default ?? false) ||
        other.description !== (option.description ?? null) ||
        other.label !== option.label ||
        other.value !== option.value
      )
        return false;
      if ((option.emoji && !other.emoji) || (!option.emoji && other.emoji))
        return false;
      if (option.emoji && other.emoji) {
        if (!compareEmoji(option.emoji, other.emoji)) return false;
      }
      return true;
    });
  }
}

export class PageStringSelect extends PageSelect {}

export interface PageUserSelectOptions {
  handler: (interaction: GetConnectorType<'UserSelectMenuInteraction'>) => void;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export class PageUserSelect implements ExportableToDjsComponent {
  type: ComponentType.UserSelect = ComponentType.UserSelect;
  handler: (interaction: GetConnectorType<'UserSelectMenuInteraction'>) => void;
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

  toApiComponent(id: string): UserSelectMenuBuilder {
    const options: APIUserSelectComponent = {
      type: ComponentType.UserSelect,
      min_values: this.minValues,
      max_values: this.maxValues,
      disabled: this.disabled,
      custom_id: id,
    };
    if (this.placeholder) options.placeholder = this.placeholder;
    const builder = new UserSelectMenuBuilder(options);
    return builder;
  }

  compareToComponent(component: ComparableComponent) {
    if (!(component.type === ComponentType.UserSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.max_values ||
      this.minValues !== component.min_values ||
      this.placeholder !== component.placeholder
    )
      return false;
    return true;
  }
}

export interface PageRoleSelectOptions {
  handler: (interaction: GetConnectorType<'RoleSelectMenuInteraction'>) => void;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export class PageRoleSelect implements ExportableToDjsComponent {
  type: ComponentType.RoleSelect = ComponentType.RoleSelect;
  handler: (interaction: GetConnectorType<'RoleSelectMenuInteraction'>) => void;
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

  toApiComponent(id: string) {
    const options: APIRoleSelectComponent = {
      type: ComponentType.RoleSelect,
      min_values: this.minValues,
      max_values: this.maxValues,
      disabled: this.disabled,
      custom_id: id,
    };
    if (this.placeholder) options.placeholder = this.placeholder;
    const builder = new RoleSelectMenuBuilder(options);
    return builder;
  }

  compareToComponent(component: ComparableComponent) {
    if (!(component.type === ComponentType.StringSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.max_values ||
      this.minValues !== component.min_values ||
      this.placeholder !== component.placeholder
    )
      return false;
    return true;
  }
}

export interface PageChannelSelectOptions {
  handler: (
    interaction: GetConnectorType<'ChannelSelectMenuInteraction'>
  ) => void;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
  channelTypes?: ChannelType[];
}

export class PageChannelSelect implements ExportableToDjsComponent {
  type: ComponentType.ChannelSelect = ComponentType.ChannelSelect;
  handler: (
    interaction: GetConnectorType<'ChannelSelectMenuInteraction'>
  ) => void;
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

  toApiComponent(id: string) {
    const options: APIChannelSelectComponent = {
      type: ComponentType.ChannelSelect,
      min_values: this.minValues,
      max_values: this.maxValues,
      disabled: this.disabled,
      custom_id: id,
    };
    if (this.channelTypes) options.channel_types = this.channelTypes;
    if (this.placeholder) options.placeholder = this.placeholder;
    const builder = new ChannelSelectMenuBuilder(options);
    return builder;
  }

  compareToComponent(component: ComparableComponent) {
    if (!(component.type === ComponentType.ChannelSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.max_values ||
      this.minValues !== component.min_values ||
      this.placeholder !== component.placeholder
    )
      return false;
    return true;
  }
}

export interface PageMentionableSelectOptions {
  handler: (
    interaction: GetConnectorType<'MentionableSelectMenuInteraction'>
  ) => void;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export class PageMentionableSelect implements ExportableToDjsComponent {
  type: ComponentType.MentionableSelect = ComponentType.MentionableSelect;
  handler: (
    interaction: GetConnectorType<'MentionableSelectMenuInteraction'>
  ) => void;
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

  toApiComponent(id: string) {
    const options: APIMentionableSelectComponent = {
      type: ComponentType.MentionableSelect,
      min_values: this.minValues,
      max_values: this.maxValues,
      disabled: this.disabled,
      custom_id: id,
    };
    if (this.placeholder) options.placeholder = this.placeholder;
    const builder = new MentionableSelectMenuBuilder(options);
    return builder;
  }

  compareToComponent(component: ComparableComponent) {
    if (!(component.type === ComponentType.MentionableSelect)) return false;
    if (
      this.disabled !== component.disabled ||
      this.maxValues !== component.max_values ||
      this.minValues !== component.min_values ||
      this.placeholder !== component.placeholder
    )
      return false;
    return true;
  }
}

function compareEmoji(
  aEmoji: APIMessageComponentEmoji,
  bEmoji: APIMessageComponentEmoji
) {
  if (aEmoji.id) {
    return aEmoji.id === bEmoji.id;
  } else {
    return aEmoji.name === bEmoji.name;
  }
}
