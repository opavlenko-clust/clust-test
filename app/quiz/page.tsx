import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QuizForm from './QuizForm'

export default async function QuizPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const gender = user.user_metadata?.gender
  if (gender) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Вкажіть вашу стать
        </h1>
        <p className="text-gray-500 text-center mb-8">
          Це допоможе нам персоналізувати ваш досвід
        </p>
        <QuizForm />
      </div>
    </main>
  )
}
