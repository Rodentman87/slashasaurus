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
  toDjsComponent(id: string): ButtonBuilder | SelectMenuBuilder;
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
  type: 'BUTTON' = 'BUTTON';
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
  type: 'BUTTON' = 'BUTTON';
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
  options: SelectMenuOptionBuilder[];
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export class PageSelect implements ExportableToDjsComponent {
  type: 'SELECT_MENU' = 'SELECT_MENU';
  handler: (interaction: SelectMenuInteraction) => void;
  options: SelectMenuOptionBuilder[];
  placeholder?: string;
  minValues = 1;
  maxValues = 1;
  disabled = false;

  constructor(options: PageSelectOptions) {
    this.handler = options.handler;
    this.options = options.options;
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
    if (!(component.type === ComponentType.SelectMenu)) return false;
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
