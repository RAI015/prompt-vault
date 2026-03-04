type BaseFieldSchema = {
  key: string;
  label?: string;
  placeholder?: string;
  example?: string;
};

export type LongTextFieldSchema = BaseFieldSchema & {
  type: "longText";
};

export type SelectFieldSchema = BaseFieldSchema & {
  type: "select";
  options: string[];
};

export type FieldSchema = LongTextFieldSchema | SelectFieldSchema;

export const PLACEHOLDER_FIELD_SCHEMAS: FieldSchema[] = [
  {
    key: "env",
    type: "select",
    label: "環境",
    options: ["local", "dev", "stg", "prod"],
  },
  {
    key: "priority",
    type: "select",
    label: "優先度",
    options: ["critical", "high", "medium", "low"],
  },
  {
    key: "error_logs",
    type: "longText",
    label: "エラーログ",
    placeholder: "エラーログを貼り付け",
    example: `PrismaClientInitializationError: Can't reach database server at \`db.example.supabase.co:5432\`

Environment:
- local (pnpm dev)
- Node: 20.x
- OS: macOS

Steps tried:
- nslookup db.example.supabase.co -> No answer
- Retry with DNS 1.1.1.1 -> OK`,
  },
];

const PLACEHOLDER_FIELD_SCHEMA_BY_KEY = new Map<string, FieldSchema>();

for (const schema of PLACEHOLDER_FIELD_SCHEMAS) {
  if (PLACEHOLDER_FIELD_SCHEMA_BY_KEY.has(schema.key)) {
    throw new Error(`Duplicate placeholder field schema key: ${schema.key}`);
  }
  PLACEHOLDER_FIELD_SCHEMA_BY_KEY.set(schema.key, schema);
}

export const getPlaceholderFieldSchema = (key: string): FieldSchema | undefined => {
  return PLACEHOLDER_FIELD_SCHEMA_BY_KEY.get(key);
};
