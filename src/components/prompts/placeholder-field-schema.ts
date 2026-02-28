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
