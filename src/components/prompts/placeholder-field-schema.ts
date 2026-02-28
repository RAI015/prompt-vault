export type FieldType = "longText";

export type FieldSchema = {
  key: string;
  type: FieldType;
  label?: string;
  placeholder?: string;
  example?: string;
};

export const PLACEHOLDER_FIELD_SCHEMAS: FieldSchema[] = [
  {
    key: "error_logs",
    type: "longText",
    label: "Error logs",
    placeholder: "Paste error logs here...",
  },
  {
    key: "error_log",
    type: "longText",
    label: "Error log",
    placeholder: "Paste error log here...",
  },
];

export const getPlaceholderFieldSchema = (key: string): FieldSchema | undefined => {
  return PLACEHOLDER_FIELD_SCHEMAS.find((schema) => schema.key === key);
};
