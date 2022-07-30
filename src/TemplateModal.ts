import { TextInputBuilder } from '@discordjs/builders';
import {
  ActionRowBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputStyle,
  ModalActionRowComponentBuilder,
  ComponentType,
} from 'discord.js';

type ExtractFromDelimiters<
  S extends string,
  L extends string,
  R extends string
> = string extends S
  ? string[]
  : S extends ''
  ? []
  : S extends `${infer _T}${L}${infer U}${R}${infer V}`
  ? [U, ...ExtractFromDelimiters<V, L, R>]
  : [];

type ReadonlyTextInputProps = {
  readonly customId: string;
  readonly label: string;
  readonly required: boolean;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly placeholder?: string;
  readonly style?: TextInputStyle;
  readonly value?: string;
};

type ModalValuesType<T extends ReadonlyArray<ReadonlyTextInputProps>> = {
  [Key in T[number]['customId']]: string;
};

type ModalValuesVariablesType<T extends ReadonlyArray<ReadonlyTextInputProps>> =
  {
    [Key in keyof T]: T[Key] extends {
      readonly value: infer V;
    }
      ? V extends string
        ? ExtractFromDelimiters<V, '{{', '}}'>[number]
        : never
      : never;
  };

type ModalPlaceholderVariablesType<
  T extends ReadonlyArray<ReadonlyTextInputProps>
> = {
  [Key in keyof T]: T[Key] extends {
    readonly placeholder: infer V;
  }
    ? V extends string
      ? ExtractFromDelimiters<V, '{{', '}}'>[number]
      : never
    : never;
};

type ModalLabelVariablesType<T extends ReadonlyArray<ReadonlyTextInputProps>> =
  {
    [Key in keyof T]: T[Key] extends {
      readonly label: infer V;
    }
      ? V extends string
        ? ExtractFromDelimiters<V, '{{', '}}'>[number]
        : never
      : never;
  };

type ModalComponentVariablesType<
  T extends ReadonlyArray<ReadonlyTextInputProps>
> =
  | ModalLabelVariablesType<T>[number]
  | ModalPlaceholderVariablesType<T>[number]
  | ModalValuesVariablesType<T>[number];

type GetModalVariablesInput<
  T extends ReadonlyArray<ReadonlyTextInputProps>,
  U extends string
> = {
  [Key in
    | ModalComponentVariablesType<T>
    | ExtractFromDelimiters<U, '{{', '}}'>[number]]: string;
};

function replaceVariables(target: string, variables: any) {
  return target.replace(/\{\{(.+?)\}\}/g, (_, variable) => variables[variable]);
}

export class TemplateModal<
  T extends ReadonlyArray<ReadonlyTextInputProps>,
  U extends string
> {
  public readonly title: string;
  public readonly customId: string;
  public readonly components: T;
  public readonly handler: (
    interaction: ModalSubmitInteraction,
    values: ModalValuesType<T>
  ) => void;

  public constructor(
    title: U,
    customId: string,
    components: T,
    handler: (
      interaction: ModalSubmitInteraction,
      values: ModalValuesType<T>
    ) => void
  ) {
    this.title = title;
    this.customId = customId;
    this.components = components;
    this.handler = handler;
  }

  public getModal(variables: GetModalVariablesInput<T, U>): ModalBuilder {
    const title = replaceVariables(this.title, variables);
    const modal = new ModalBuilder({
      title,
      customId: this.customId,
      components: this.components.map((component) => {
        const row = new ActionRowBuilder<ModalActionRowComponentBuilder>();
        const textInput = new TextInputBuilder({
          type: ComponentType.TextInput,
          custom_id: component.customId,
          style: component.style ?? TextInputStyle.Short,
          label: replaceVariables(component.label, variables),
          required: component.required,
        });
        if (component.maxLength) textInput.setMaxLength(component.maxLength);
        if (component.minLength) textInput.setMinLength(component.minLength);
        if (component.placeholder)
          textInput.setPlaceholder(
            replaceVariables(component.placeholder, variables)
          );
        if (component.value)
          textInput.setValue(replaceVariables(component.value, variables));
        row.addComponents(textInput);
        return row;
      }),
    });
    return modal;
  }
}
