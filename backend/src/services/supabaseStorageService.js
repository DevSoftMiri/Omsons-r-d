import { createClient } from '@supabase/supabase-js';

let supabase;

function getSupabaseClient() {
  if (supabase) return supabase;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase storage is not configured');
  }

  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return supabase;
}

export function getProjectDocumentsBucket() {
  return process.env.SUPABASE_PROJECT_DOCUMENTS_BUCKET || 'project-documents';
}

export async function uploadProjectDocument({ path, buffer, mimeType }) {
  const client = getSupabaseClient();
  const bucket = getProjectDocumentsBucket();
  const { error } = await client.storage.from(bucket).upload(path, buffer, {
    contentType: mimeType,
    upsert: true
  });

  if (error) throw new Error(error.message);

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return {
    storagePath: path,
    publicUrl: data.publicUrl
  };
}

export async function deleteProjectDocument(path) {
  if (!path) return;
  const client = getSupabaseClient();
  const bucket = getProjectDocumentsBucket();
  await client.storage.from(bucket).remove([path]);
}
