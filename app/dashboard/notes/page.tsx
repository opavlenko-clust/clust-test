import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getNotes } from '@/app/actions/notes';
import NoteForm from './NoteForm';
import NotesList from './NotesList';

export const dynamic = 'force-dynamic';

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/sign-in');
  }

  const { notes } = await getNotes();

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-xl font-bold text-gray-900 mb-8">Нотатки</h1>

      <div className="space-y-8">
        <NoteForm />
        <NotesList notes={notes} />
      </div>
    </div>
  );
}
