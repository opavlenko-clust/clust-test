'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Note } from '@/types/database';

export async function createNote(title: string, content: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  const { error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: title.trim(),
      content: content.trim(),
    });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/notes');
  return { success: true };
}

export async function getNotes(): Promise<{ notes: Note[]; error?: string }> {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { notes: [], error: 'Unauthorized' };
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { notes: [], error: error.message };
  }

  return { notes: data || [] };
}
