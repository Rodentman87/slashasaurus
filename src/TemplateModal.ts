import {
  MessageActionRow,
  Modal,
  ModalActionRowComponent,
  ModalSubmitInteraction,
  TextInputComponent,
  TextInputStyle,
} from 'discord.js';
import { TextInputStyles } from 'discord.js/typings/enums';

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

  public getModal(variables: GetModalVariablesInput<T, U>): Modal {
    const title = replaceVariables(this.title, variables);
    const modal = new Modal({
      title,
      customId: this.customId,
      components: this.components.map((component) => {
        const row = new MessageActionRow<ModalActionRowComponent>();
        const textInput = new TextInputComponent({
          ...component,
          style: component.style ?? TextInputStyles.SHORT,
          label: replaceVariables(component.label, variables),
        });
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
