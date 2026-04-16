'use client';

import { useState } from 'react';
import { createNote } from '@/app/actions/notes';

export default function NoteForm() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Заголовок обов\'язковий');
      return;
    }

    setLoading(true);

    const result = await createNote(title, content);

    if (result.success) {
      setTitle('');
      setContent('');
    } else {
      setError(result.error || 'Помилка створення нотатки');
    }

    setLoading(false);
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Додати нотатку</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Заголовок
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Введіть заголовок"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            Текст
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Введіть текст нотатки"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Створення...' : 'Додати нотатку'}
        </button>
      </form>
    </div>
  );
}
