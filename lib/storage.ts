type StorageObjectInput = {
  lessonId: string;
  kind: "recording" | "transcript" | "summary";
  extension: string;
};

export function buildStorageObject(input: StorageObjectInput) {
  const bucket = process.env.S3_BUCKET ?? null;
  const region = process.env.S3_REGION ?? null;
  const baseUrl = process.env.S3_PUBLIC_BASE_URL ?? null;
  const key = `lessons/${input.lessonId}/${input.kind}.${input.extension}`;
  const publicUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/${key}` : null;

  return {
    bucket,
    region,
    key,
    publicUrl
  };
}

