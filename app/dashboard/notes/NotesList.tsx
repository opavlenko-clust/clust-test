'use client';

import type { Note } from '@/types/database';

interface NotesListProps {
  notes: Note[];
}

export default function NotesList({ notes }: NotesListProps) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        Нотаток поки немає. Додайте першу!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Ваші нотатки</h2>
      
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900 text-sm">{note.title}</h3>
              <time className="text-sm text-gray-500">
                {new Date(note.created_at).toLocaleDateString('uk-UA', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            </div>
            
            {note.content && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
