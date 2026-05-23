import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">VideoEdit Academy</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Онлайн-платформа курсов по монтажу видео.
        Здесь будет лендинг — реализуй его согласно ТЗ.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/courses"
          className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Начать обучение
        </Link>
        <Link
          href="/program"
          className="rounded-md border border-input bg-background px-6 py-3 font-medium hover:bg-accent"
        >
          Программа курсов
        </Link>
      </div>
    </main>
  );
}
